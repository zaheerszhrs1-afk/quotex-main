// Lightweight real-time metrics collector for the Socket.io server.
// Tracks connections, message throughput, tick-loop timing, event-handler
// latency and reconnect storms. All counters are in-memory (no DB hot path).

const { performance } = require('perf_hooks')

const HISTORY_SECONDS = 120 // keep last 2 minutes of per-second snapshots

const state = {
  startedAt: Date.now(),

  // instantaneous gauges
  connections: 0,
  rooms: 0,
  openTrades: 0,
  feedStatus: [],

  // counters since boot
  totalConnections: 0,
  totalDisconnections: 0,
  totalReconnects: 0,
  messagesSent: 0,
  messagesReceived: 0,

  // current-second buckets (reset every second)
  sentThisSecond: 0,
  recvThisSecond: 0,
  reconnectsThisSecond: 0,

  // tick loop timing (micro-benchmark of the main 250ms interval)
  lastTickMs: 0,
  tickMsHistory: [], // rolling last N durations

  // per-event handler latency rolling stats
  eventLatencies: {}, // eventName -> { count, totalMs, maxMs, avgMs }

  // per-second snapshots for sparklines
  history: [], // [{ t, connections, sentPerSec, recvPerSec, reconnectsPerSec, tickMs, memoryMb }]
}

function mb(bytes) {
  return Math.round((bytes / 1024 / 1024) * 10) / 10
}

function recordConnection() {
  state.connections++
  state.totalConnections++
}

const RECONNECT_REASONS = new Set([
  'ping timeout',
  'transport close',
  'transport error',
  'forced close',
  'forced server close',
])

function recordDisconnection(reason = '') {
  state.connections = Math.max(0, state.connections - 1)
  state.totalDisconnections++
  // A disconnect that was not explicitly initiated by the client is treated as
  // a reconnect storm signal: network drop, proxy timeout, server restart etc.
  if (RECONNECT_REASONS.has(reason)) {
    state.totalReconnects++
    state.reconnectsThisSecond++
  }
}

function recordReconnect() {
  // transport-level reconnect attempt (client came back with same sid after drop)
  state.totalReconnects++
  state.reconnectsThisSecond++
}

function recordMessageSent(n = 1) {
  state.messagesSent += n
  state.sentThisSecond += n
}

function recordMessageReceived(n = 1) {
  state.messagesReceived += n
  state.recvThisSecond += n
}

function recordTickDuration(ms) {
  state.lastTickMs = Math.round(ms * 100) / 100
  state.tickMsHistory.push(state.lastTickMs)
  if (state.tickMsHistory.length > 60) state.tickMsHistory.shift()
}

function recordEventLatency(eventName, ms) {
  const s = (state.eventLatencies[eventName] = state.eventLatencies[eventName] || {
    count: 0,
    totalMs: 0,
    maxMs: 0,
    avgMs: 0,
  })
  s.count++
  s.totalMs += ms
  if (ms > s.maxMs) s.maxMs = ms
  s.avgMs = Math.round((s.totalMs / s.count) * 100) / 100
}

function setGauges({ rooms, openTrades, feedStatus }) {
  if (rooms != null) state.rooms = rooms
  if (openTrades != null) state.openTrades = openTrades
  if (feedStatus != null) state.feedStatus = feedStatus
}

// Patch an io.Server or Socket instance so direct .emit() calls increment our
// outgoing message counter.
function patchEmitForMetrics(target) {
  if (!target || target.__metricsPatched) return
  target.__metricsPatched = true
  const originalEmit = target.emit.bind(target)
  target.emit = function (eventName, ...args) {
    // ignore internal socket.io probe/ping packets so the rate reflects app traffic
    if (!eventName.startsWith('socket.io')) recordMessageSent(1)
    return originalEmit(eventName, ...args)
  }
}

// Patch the namespace adapter's broadcast() so room-targeted emits
// (io.to(...).emit, socket.to(...).emit) are also counted.
function patchAdapterForMetrics(adapter) {
  if (!adapter || adapter.__metricsPatched) return
  adapter.__metricsPatched = true
  const originalBroadcast = adapter.broadcast.bind(adapter)
  adapter.broadcast = function (packet, opts) {
    if (packet && packet.nsp != null) {
      // packet.data = [eventName, ...args]
      const eventName = packet.data && packet.data[0]
      if (typeof eventName === 'string' && !eventName.startsWith('socket.io')) {
        // count 1 message per target socket; fall back to 1 if we can't tell
        const count = (opts && opts.rooms && opts.rooms.size) || 1
        recordMessageSent(count)
      }
    }
    return originalBroadcast(packet, opts)
  }
}

// Snapshot called once per second. Stores per-second rates and resets buckets.
function takeSnapshot() {
  const mem = process.memoryUsage()
  const snapshot = {
    t: Date.now(),
    connections: state.connections,
    rooms: state.rooms,
    openTrades: state.openTrades,
    feedStatus: state.feedStatus,
    sentPerSec: state.sentThisSecond,
    recvPerSec: state.recvThisSecond,
    reconnectsPerSec: state.reconnectsThisSecond,
    tickMs: state.lastTickMs,
    memoryMb: mb(mem.rss),
    heapMb: mb(mem.heapUsed),
  }
  state.history.push(snapshot)
  if (state.history.length > HISTORY_SECONDS) state.history.shift()

  // reset per-second buckets
  state.sentThisSecond = 0
  state.recvThisSecond = 0
  state.reconnectsThisSecond = 0
  return snapshot
}

function getSnapshot() {
  const mem = process.memoryUsage()
  const latest = state.history[state.history.length - 1] || takeSnapshot()
  const tickAvg =
    state.tickMsHistory.length > 0
      ? Math.round((state.tickMsHistory.reduce((a, b) => a + b, 0) / state.tickMsHistory.length) * 100) / 100
      : 0

  // slowest events, sorted by avg latency desc
  const slowEvents = Object.entries(state.eventLatencies)
    .map(([name, s]) => ({ name, count: s.count, avgMs: s.avgMs, maxMs: s.maxMs }))
    .sort((a, b) => b.avgMs - a.avgMs)
    .slice(0, 10)

  return {
    uptimeSeconds: Math.floor((Date.now() - state.startedAt) / 1000),
    connections: state.connections,
    rooms: state.rooms,
    openTrades: state.openTrades,
    feedStatus: state.feedStatus,
    totalConnections: state.totalConnections,
    totalDisconnections: state.totalDisconnections,
    totalReconnects: state.totalReconnects,
    messagesSent: state.messagesSent,
    messagesReceived: state.messagesReceived,
    sentPerSec: latest.sentPerSec,
    recvPerSec: latest.recvPerSec,
    reconnectsPerSec: latest.reconnectsPerSec,
    tickMs: state.lastTickMs,
    tickAvgMs: tickAvg,
    memoryMb: mb(mem.rss),
    heapMb: mb(mem.heapUsed),
    slowEvents,
    history: state.history,
  }
}

module.exports = {
  recordConnection,
  recordDisconnection,
  recordReconnect,
  recordMessageSent,
  recordMessageReceived,
  recordTickDuration,
  recordEventLatency,
  setGauges,
  patchEmitForMetrics,
  patchAdapterForMetrics,
  takeSnapshot,
  getSnapshot,
}
