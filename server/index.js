// Express + Socket.io real-time server.
//
// Socket protocol (my own design):
//   connect            -> optional handshake auth { token } (from /api/socket-token)
//   'subscribe'  {symbol, timeframe}  -> joins room, server replies 'history'
//   'unsubscribe'{symbol, timeframe}
//   server 'candle' {symbol, tf, candle, closed, price}  (per tick, per room)
//   server 'summary' [ {symbol, price, changePct, payout, ...} ]  (per tick, all clients)
//   'open_trade' {symbol, direction, amount, duration, accountType} -> 'trade_opened' | 'trade_error'
//   server 'trade_closed' {result, profit, balance, ...}  (to user room on expiry)
//   server 'balance' {demoBalance, realBalance}

// Load env from .env.local (local dev) then .env (Dokploy/production) as a fallback.
// dotenv never overrides variables already present in process.env, so when the host
// (e.g. Dokploy) injects real env vars, those win and missing files are harmless.
require('dotenv').config({ path: '.env.local' })
require('dotenv').config()

const http = require('http')
const express = require('express')
const cors = require('cors')
const { Server } = require('socket.io')

const connectDB = require('../lib/db')
const Asset = require('../lib/models/Asset')
const Trade = require('../lib/models/Trade')
const User = require('../lib/models/User')
const { verifyAccessToken } = require('../lib/auth')
const engine = require('./priceEngine')
const { TIMEFRAMES } = require('./priceEngine')
const { ASSETS } = require('../lib/assetsConfig')
const resolver = require('./tradeResolver')
const marketFeed = require('./marketFeed')
const metrics = require('./metrics')
const { logAdmin } = require('../lib/auditLog')

const PORT = process.env.WS_PORT || 5001
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:3000'
const TICK_MS = 250 // 4 price updates/sec => smooth forming candle
const ALLOWED_DURATIONS = new Set([5, 10, 15, 30, 60, 120, 300, 900, 1800, 3600])

async function main() {
  await connectDB()

  // Load assets from DB (fall back to engine defaults if none seeded yet).
  // The DB stores name/category/payout/basePrice; volatility + digits live in
  // assetsConfig, so merge them by symbol (otherwise prices round to 2 digits
  // and forex pairs jump in giant 0.01 steps).
  const cfgBySymbol = Object.fromEntries(ASSETS.map((a) => [a.symbol, a]))
  let assetDefs = []
  try {
    const dbAssets = await Asset.find({ isActive: true })
    assetDefs = dbAssets.map((a) => {
      const cfg = cfgBySymbol[a.symbol] || {}
      return {
        symbol: a.symbol,
        name: a.name,
        category: a.category,
        basePrice: a.basePrice,
        payout: a.payout,
        volatility: cfg.volatility,
        digits: cfg.digits != null ? cfg.digits : 2,
      }
    })
  } catch (e) {
    console.warn('[server] could not read assets, using defaults:', e.message)
  }
  // include config assets not present in the DB (e.g. newly added stocks) so the
  // engine simulates prices for them without requiring a re-seed
  const haveSym = new Set(assetDefs.map((a) => a.symbol))
  for (const a of ASSETS) {
    if (!haveSym.has(a.symbol)) assetDefs.push({ ...a })
  }
  engine.init(assetDefs)
  console.log(`[server] price engine ready for ${engine.allMeta().length} assets`)

  const app = express()
  app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }))
  app.get('/health', (_req, res) => res.json({ ok: true, openTrades: resolver.openCount() }))
  app.get('/health/metrics', (_req, res) => res.json(metrics.getSnapshot()))

  const server = http.createServer(app)
  const io = new Server(server, {
    cors: { origin: CLIENT_ORIGIN, credentials: true, methods: ['GET', 'POST'] },
    pingInterval: 15000, // keep the WS warm so mobile NAT/proxies don't idle-drop
    pingTimeout: 10000,
  })

  // Count outgoing app-level broadcasts and per-socket emits.
  metrics.patchEmitForMetrics(io)
  metrics.patchAdapterForMetrics(io.of('/').adapter)

  resolver.setup(io, engine)
  await resolver.loadOpenFromDB()
  await resolver.loadControl() // restore persisted admin settings (survive restart)

  // Fetch REAL Binance history for a symbol (with retries) and load it into the
  // engine, which also un-freezes the asset for live streaming. Returns false if
  // real data couldn't be obtained — caller should NOT fake it.
  async function loadRealHistory(symbol, tries = 3) {
    for (let i = 0; i < tries; i++) {
      try {
        const hist = await marketFeed.backfillAll(symbol)
        if (hist) {
          engine.applyRealHistory(symbol, hist)
          return true
        }
      } catch (e) {
        console.warn('[live] backfill attempt failed:', e.message)
      }
      await new Promise((r) => setTimeout(r, 800))
    }
    return false
  }


  async function enableLiveFor(symbol) {
    if (!marketFeed.isSupported(symbol)) return false
    // Subscribe ONLY to this symbol on the provider WS (not every supported
    // asset) so we never approach Finnhub's free-tier rate limit.
    marketFeed.addLiveSymbol(symbol)
    const hasLivePrice = await marketFeed.waitForLivePrice(symbol, 10000)
    if (!hasLivePrice) {
      console.warn('[live] live feed unavailable for', symbol, '— staying simulated')
      marketFeed.removeLiveSymbol(symbol)
      return false
    }
    resolver.setLiveAsset(symbol, true) // engine.setLive → frozen until real history loads
    const ok = await loadRealHistory(symbol)
    if (!ok) {
      console.warn('[live] real history unavailable for', symbol, '— reverting')
      resolver.setLiveAsset(symbol, false)
      marketFeed.removeLiveSymbol(symbol)
      return false
    }
    return true
  }

  function resetChartsFor(symbols) {
    for (const sym of symbols) emitPlanForSymbol(sym)
    for (const sym of symbols) io.emit('chart_reset', { symbol: sym })
    emitAllPlans()
  }

  function showChartLoading(symbols) {
    for (const sym of symbols) io.emit('chart_reset', { symbol: sym, loading: true })
  }

  // After a feed outage (net drop), refresh the chart history for any live asset
  // so the recovered gap shows real intermediate candles, not one long bridge.
  marketFeed.setOnGap((symbol) => {
    if (!engine.isLive(symbol)) return
    loadRealHistory(symbol).then((ok) => {
      if (!ok) return
      emitPlanForSymbol(symbol)
      io.emit('chart_reset', { symbol }) // make watchers reload the gap-filled history
    })
  })

  // International (real feed) mode is per-asset. loadControl() already applied
  // engine.setLive() for any persisted live assets — start the feed and backfill
  // real history for each so scrollback is genuine after a restart.
  if (resolver.getLiveAssets().length) {
    // Restore only the persisted live assets — the WS subscribes to just these,
    // not every supported symbol, so a restart never trips the Finnhub rate limit.
    marketFeed.setLiveWanted(resolver.getLiveAssets())
    for (const sym of resolver.getLiveAssets()) {
      loadRealHistory(sym).then((ok) => {
        if (!ok) console.warn('[live] boot backfill failed for', sym)
      })
    }
  }

  // Crypto (BTC, ETH) goes live automatically — Binance WS is free, no API key
  // needed, and real candles look far better than simulated ones. If Binance is
  // unreachable (blocked region / outage) it falls back to simulated after 10s.
  for (const sym of ['BTC/USD', 'ETH/USD']) {
    if (!marketFeed.isSupported(sym) || engine.isLive(sym)) continue
    enableLiveFor(sym).then((ok) => {
      if (ok) console.log('[live] auto-enabled', sym, 'via Binance')
      else console.log('[live] auto-enable failed for', sym, '— staying simulated')
    })
  }

  // which admin socket is watching which (symbol, timeframe) for candle control
  const planSubs = new Map() // socketId -> { symbol, timeframe }
  // build the plan series + attach the auto-profit toggle state for the UI
  function buildPlan(symbol, tf) {
    const s = engine.getAdminSeries(symbol, tf)
    if (s) {
      s.auto = resolver.getAutoAssets().includes(symbol)
      s.autoAll = resolver.getAutoAll()
      s.mode = resolver.getMode()
      s.strict = resolver.getStrict() // legacy UI compatibility
      s.countDemo = resolver.getCountDemo()
      // international mode (per-asset). liveSupported = this asset CAN go live
      // (has a Binance feed); live = it currently IS. For a live symbol the admin
      // sees the LIVE real price; clients see it 30s delayed.
      const liveAssets = resolver.getLiveAssets()
      const supportedLiveAssets = marketFeed.supportedSymbols()
      s.liveSupported = marketFeed.isSupported(symbol)
      s.feed = marketFeed.providerInfo(symbol)
      s.live = engine.isLive(symbol)
      s.liveAssets = liveAssets
      s.supportedLiveCount = supportedLiveAssets.length
      s.configuredLiveCount = marketFeed.allConfiguredSymbols().length
      s.tradingView = resolver.getTradingView()
      if (s.live) {
        s.livePrice = marketFeed.livePrice(symbol) // admin (now)
        s.clientPrice = marketFeed.delayedPrice(symbol) // what users see after MARKET_DELAY_MS
        s.delayMs = marketFeed.DELAY_MS
      }
    }
    return s
  }
  function emitAllPlans() {
    for (const [id, sub] of planSubs) {
      const s = io.sockets.sockets.get(id)
      if (s) {
        const series = buildPlan(sub.symbol, sub.timeframe)
        if (series) s.emit('admin:plan', series)
      }
    }
  }
  function emitPlanForSymbol(symbol) {
    if (!symbol) return
    for (const [id, sub] of planSubs) {
      if (sub.symbol !== symbol) continue
      const s = io.sockets.sockets.get(id)
      if (s) {
        const series = buildPlan(symbol, sub.timeframe)
        if (series) s.emit('admin:plan', series)
      }
    }
  }

  // --- metrics: incoming message counter + automatic handler timing --------
  io.use((socket, next) => {
    const { performance } = require('perf_hooks')

    // count received app-level packets
    const onevent = socket.onevent.bind(socket)
    socket.onevent = function (packet) {
      if (packet.data && packet.data[0] && typeof packet.data[0] === 'string' && !packet.data[0].startsWith('socket.io')) {
        metrics.recordMessageReceived(1)
      }
      return onevent(packet)
    }

    // transparently time every socket.on() handler
    const originalOn = socket.on.bind(socket)
    socket.on = function (eventName, handler) {
      if (typeof eventName !== 'string' || eventName === 'disconnect' || eventName.startsWith('socket.io')) {
        return originalOn(eventName, handler)
      }
      return originalOn(eventName, function (...args) {
        const start = performance.now()
        const finish = () => metrics.recordEventLatency(eventName, performance.now() - start)
        try {
          const result = handler.apply(this, args)
          if (result && typeof result.then === 'function') {
            result.then(finish, finish)
          } else {
            finish()
          }
          return result
        } catch (e) {
          finish()
          throw e
        }
      })
    }

    next()
  })

  // --- metrics: connection / reconnection gauges ---------------------------
  io.engine.on('connection', (rawSocket) => {
    metrics.recordConnection()
  })

  // --- socket handlers -----------------------------------------------------
  io.on('connection', (socket) => {
    // Count outgoing per-socket emits and transport reconnections.
    metrics.patchEmitForMetrics(socket)
    if (socket.recovered || (socket.conn && socket.conn.recovered)) {
      // socket.io v4+ may flag recovered sessions after a transport drop
      metrics.recordReconnect()
    }

    // optional auth
    const token = socket.handshake.auth?.token
    const payload = token ? verifyAccessToken(token) : null
    socket.data.userId = payload?.sub || null
    socket.data.isAdmin = payload?.role === 'admin'
    if (socket.data.userId) socket.join(`user:${socket.data.userId}`)
    // admins join a dedicated room and immediately get the live trades snapshot
    if (socket.data.isAdmin) {
      socket.join('admins')
      socket.emit('admin:trades', resolver.getOpenForAdmin())
      socket.emit('admin:metrics', metrics.getSnapshot())
    }
    // TradingView embed is disabled; clients always use the internal chart.
    socket.emit('tradingview_mode', { on: false })

    // --- admin candle control (all in-memory, no DB) ---
    socket.on('admin:watch_plan', ({ symbol, timeframe } = {}) => {
      if (!socket.data.isAdmin) return
      if (!symbol || !timeframe || !TIMEFRAMES[timeframe]) return
      planSubs.set(socket.id, { symbol, timeframe })
      const series = buildPlan(symbol, timeframe)
      if (series) socket.emit('admin:plan', series)
    })
    socket.on('admin:metrics', () => {
      if (!socket.data.isAdmin) return
      socket.emit('admin:metrics', metrics.getSnapshot())
    })
    socket.on('admin:auto_asset', ({ symbol, on } = {}) => {
      if (!socket.data.isAdmin) return
      if (engine.isLive(symbol)) return // can't steer a live real-feed asset
      resolver.setAuto(symbol, !!on)
      emitPlanForSymbol(symbol)
    })
    // legacy: TradingView embed is intentionally disabled because it breaks the
    // Quotex-style UI. Use admin:live_asset to feed the internal chart with real
    // provider data instead.
    socket.on('admin:tradingview', ({ on } = {}) => {
      if (!socket.data.isAdmin) return
      resolver.setTradingView(false)
      io.emit('tradingview_mode', { on: false })
      emitAllPlans()
      logAdmin({
        adminId: socket.data.userId,
        action: 'market.tradingview.disabled',
        target: 'all',
        summary: 'TradingView embed disabled; internal real market chart is used instead',
        meta: { requested: !!on, applied: false },
      })
    })

    socket.on('admin:live_asset', async ({ symbol, on } = {}) => {
      if (!socket.data.isAdmin) return
      if (!symbol || !marketFeed.isSupported(symbol)) return // requires a configured provider/API key for this symbol
      showChartLoading([symbol])
      if (on) await enableLiveFor(symbol)
      else {
        resolver.setLiveAsset(symbol, false)
        marketFeed.removeLiveSymbol(symbol)
      }
      // hard-reset every watcher's chart: it clears all old candles, shows a
      // loader, and re-subscribes for the fresh (real or simulated) history.
      resetChartsFor([symbol])
      console.log('[chart_reset]', symbol, '— data-source reset sent to all charts')
      logAdmin({
        adminId: socket.data.userId,
        action: 'market.live',
        target: symbol,
        summary: `${symbol} live market feed ${on ? 'ON (internal chart)' : 'OFF'}`,
        meta: { symbol, on: !!on, feed: marketFeed.providerInfo(symbol) },
      })
    })

    socket.on('admin:auto_all', ({ on } = {}) => {
      if (!socket.data.isAdmin) return
      resolver.setAutoAll(!!on)
      emitAllPlans()
    })
    socket.on('admin:auto_mode', ({ mode, strict } = {}) => {
      if (!socket.data.isAdmin) return
      // Prefer new string mode; fall back to legacy boolean for old clients.
      if (mode && ['smart', 'balanced', 'strict'].includes(mode)) {
        resolver.setMode(mode)
      } else {
        resolver.setStrict(!!strict)
      }
      emitAllPlans()
    })
    socket.on('admin:auto_count_demo', ({ on } = {}) => {
      if (!socket.data.isAdmin) return
      resolver.setCountDemo(!!on)
      emitAllPlans()
    })
    socket.on('admin:set_candle', (data, ack) => {
      if (!socket.data.isAdmin) return safeAck(ack, { error: 'Forbidden' })
      if (engine.isLive(data?.symbol)) return safeAck(ack, { error: 'Live market — steering disabled.' })
      const res = engine.setCandleOverride(data?.symbol, data || {})
      emitPlanForSymbol(data?.symbol)
      safeAck(ack, { ok: !!res, override: res })
    })
    socket.on('admin:clear_plan', ({ symbol } = {}) => {
      if (!socket.data.isAdmin) return
      engine.clearOverrides(symbol)
      emitPlanForSymbol(symbol)
    })

    // --- admin trade force control (memory only) ---
    socket.on('admin:force_trade', ({ tradeId, result } = {}) => {
      if (!socket.data.isAdmin) return
      resolver.forceTrade(tradeId, result) // 'win' | 'loss' | 'normal'
      logAdmin({
        adminId: socket.data.userId,
        action: 'trade.force',
        target: String(tradeId || ''),
        summary: `Forced trade ${tradeId} → ${result}`,
        meta: { tradeId, result },
      })
    })
    socket.on('admin:force_user', ({ userId, mode } = {}) => {
      if (!socket.data.isAdmin) return
      resolver.setUserForce(userId, mode) // 'win' | 'loss' | 'normal'
      logAdmin({
        adminId: socket.data.userId,
        action: 'user.force',
        target: String(userId || ''),
        summary: `Set user ${userId} force mode → ${mode}`,
        meta: { userId, mode },
      })
    })

    socket.on('disconnect', (reason) => {
      planSubs.delete(socket.id)
      // A disconnect that is immediately followed by a reconnect is flagged by
      // socket.io as 'transport close' / 'ping timeout' etc. Non-client reasons
      // are counted as reconnect-storm signals.
      metrics.recordDisconnection(reason)
    })

    socket.on('subscribe', ({ symbol, timeframe }) => {
      if (!symbol || !timeframe || !TIMEFRAMES[timeframe]) return
      socket.join(`${symbol}:${timeframe}`)
      const series = engine.getSeries(symbol, timeframe)
      if (series) socket.emit('history', series)
    })

    socket.on('unsubscribe', ({ symbol, timeframe }) => {
      if (symbol && timeframe) socket.leave(`${symbol}:${timeframe}`)
    })

    socket.on('open_trade', async (data, ack) => {
      try {
        const userId = socket.data.userId
        if (!userId) return safeAck(ack, { error: 'Please log in to trade.' })

        const symbol = data?.symbol
        const direction = data?.direction
        const amount = Number(data?.amount)
        const duration = Number(data?.duration)
        const accountType = data?.accountType === 'real' ? 'real' : 'demo'

        const meta = engine.getMeta(symbol)
        if (!meta) return safeAck(ack, { error: 'Unknown asset.' })
        if (!['up', 'down'].includes(direction))
          return safeAck(ack, { error: 'Invalid direction.' })
        if (!Number.isFinite(amount) || amount <= 0)
          return safeAck(ack, { error: 'Invalid amount.' })
        if (!ALLOWED_DURATIONS.has(duration))
          return safeAck(ack, { error: 'Invalid duration.' })

        const balanceField = accountType === 'real' ? 'realBalance' : 'demoBalance'
        // atomically debit the stake only if balance is sufficient
        const user = await User.findOneAndUpdate(
          { _id: userId, [balanceField]: { $gte: amount }, isBanned: false },
          { $inc: { [balanceField]: -amount } },
          { new: true }
        )
        if (!user) return safeAck(ack, { error: 'Insufficient balance.' })

        const openPrice = resolver.priceForResolve(symbol)
        const openTime = new Date()
        const closeTime = new Date(Date.now() + duration * 1000)
        const trade = await Trade.create({
          userId,
          symbol,
          direction,
          amount,
          duration,
          payout: meta.payout,
          openPrice,
          openTime,
          closeTime,
          status: 'open',
          accountType,
        })
        resolver.add(trade, user.email)
        resolver.broadcastAdmin() // instant update on the admin monitor

        // tell the user (balance updated) + the open trade details
        io.to(`user:${userId}`).emit('balance', {
          demoBalance: user.demoBalance,
          realBalance: user.realBalance,
        })
        safeAck(ack, {
          trade: {
            id: trade._id.toString(),
            symbol,
            direction,
            amount,
            duration,
            payout: meta.payout,
            openPrice,
            openTime: openTime.getTime(),
            closeTime: closeTime.getTime(),
            accountType,
          },
        })
      } catch (e) {
        console.error('[open_trade]', e)
        safeAck(ack, { error: 'Could not open trade.' })
      }
    })
  })

  function safeAck(ack, payload) {
    if (typeof ack === 'function') ack(payload)
  }

  // --- main tick loop ------------------------------------------------------
  let tickN = 0
  const liveMissingSince = new Map()
  const { performance } = require('perf_hooks')
  setInterval(async () => {
    const tickStart = performance.now()
    tickN++
    // International mode: feed each LIVE asset's DELAYED (client-facing) real
    // price into the engine before it ticks. Admin sees the live price elsewhere.
    if (resolver.getLiveAssets().length) {
      for (const sym of resolver.getLiveAssets()) {
        if (!engine.isLive(sym)) continue
        const delayed = marketFeed.delayedPrice(sym)
        if (delayed == null) {
          const since = liveMissingSince.get(sym) || Date.now()
          liveMissingSince.set(sym, since)
          if (Date.now() - since > 10000) {
            console.warn('[live] stale/missing feed for', sym, '— reverting to simulated')
            resolver.setLiveAsset(sym, false)
            marketFeed.removeLiveSymbol(sym)
            liveMissingSince.delete(sym)
            resetChartsFor([sym])
          }
          continue
        }
        liveMissingSince.delete(sym)
        engine.setExternalPrice(sym, delayed)
      }
    }
    const updates = engine.tick()
    for (const u of updates) {
      for (const tf of Object.keys(u.candles)) {
        const { candle, closed } = u.candles[tf]
        io.to(`${u.symbol}:${tf}`).emit('candle', {
          symbol: u.symbol,
          tf,
          candle,
          closed,
          price: u.price,
          digits: u.digits,
        })
      }
    }
    // sidebar summary ~1/sec (every 4th 250ms tick)
    if (tickN % 4 === 0) {
      io.emit('summary', engine.getSummary())
      // auto-profit engine: recompute loss-max targets before pushing the plan
      resolver.runAuto()
      // live trades monitor: refresh admins' countdowns ~1/sec (in-memory, no DB)
      io.to('admins').emit('admin:trades', resolver.getOpenForAdmin())
      // candle control: push the moving future plan to watching admins
      for (const [id, sub] of planSubs) {
        const s = io.sockets.sockets.get(id)
        if (s) {
          const series = buildPlan(sub.symbol, sub.timeframe)
          if (series) s.emit('admin:plan', series)
        }
      }
    }
    try {
      await resolver.checkExpiries()
    } catch (e) {
      console.error('[resolver loop]', e.message)
    }

    metrics.recordTickDuration(performance.now() - tickStart)
    metrics.setGauges({
      rooms: io.of('/').adapter.rooms.size,
      openTrades: resolver.openCount(),
      feedStatus: marketFeed.getLiveStatus(),
    })
  }, TICK_MS)

  // --- metrics heartbeat: snapshot every second + push to admins ------------
  setInterval(() => {
    metrics.takeSnapshot()
    const snapshot = metrics.getSnapshot()
    io.to('admins').emit('admin:metrics', snapshot)
  }, 1000)

  server.listen(PORT, () => {
    console.log(`[server] Socket.io listening on http://localhost:${PORT}`)
  })
}

main().catch((e) => {
  console.error('[server] fatal:', e)
  process.exit(1)
})
