// Real international market feed — multi-provider, all on free tiers.
//
//   LIVE prices (WebSocket, push):
//     Crypto                  -> Binance  (no key)
//     Forex / Commodities     -> Finnhub OANDA (FINNHUB_KEY)
//     Stocks                  -> Finnhub  (FINNHUB_KEY)
//   HISTORY (REST):
//     Crypto                  -> Binance klines (no key)
//     everything else         -> Twelve Data time_series (TWELVE_DATA_KEY)
//
// Twelve Data's free tier is REST-only (no WS) and capped at 8 credits/min, so
// we use it ONLY for occasional history backfill (a few calls per go-live), and
// stream all live prices over free push WebSockets. We keep a short timestamped
// ring buffer per OUR symbol and read:
//   - livePrice(sym)          -> latest real price   (ADMIN sees, "now")
//   - delayedPrice(sym)       -> delayed price (CLIENTS see; MARKET_DELAY_MS, default 20s)
// A symbol is "supported" only if its live provider AND a history source are
// available (i.e. the needed key is set). Everything else stays simulated.

const WebSocket = require('ws')

// ---- our asset -> { live provider, provider symbol } ------------------------
const SYMBOL_MAP = {
  // crypto (Binance, no key)
  'BTC/USD': { provider: 'binance', sym: 'BTCUSDT' },
  'ETH/USD': { provider: 'binance', sym: 'ETHUSDT' },
  // forex (Finnhub OANDA)
  'EUR/USD': { provider: 'finnhub', sym: 'OANDA:EUR_USD' },
  'GBP/USD': { provider: 'finnhub', sym: 'OANDA:GBP_USD' },
  'USD/JPY': { provider: 'finnhub', sym: 'OANDA:USD_JPY' },
  'AUD/USD': { provider: 'finnhub', sym: 'OANDA:AUD_USD' },
  // commodities (Finnhub OANDA)
  Gold: { provider: 'finnhub', sym: 'OANDA:XAU_USD' },
  Oil: { provider: 'finnhub', sym: 'OANDA:WTICO_USD' },
  // stocks (Finnhub live, Twelve Data history)
  AAPL: { provider: 'finnhub', sym: 'AAPL' },
  TSLA: { provider: 'finnhub', sym: 'TSLA' },
  AMZN: { provider: 'finnhub', sym: 'AMZN' },
  GOOGL: { provider: 'finnhub', sym: 'GOOGL' },
  MSFT: { provider: 'finnhub', sym: 'MSFT' },
  META: { provider: 'finnhub', sym: 'META' },
  NFLX: { provider: 'finnhub', sym: 'NFLX' },
  NVDA: { provider: 'finnhub', sym: 'NVDA' },
}
// twelve-data symbol used to fetch HISTORY for any non-crypto asset
const TD_HISTORY_SYM = {
  'EUR/USD': 'EUR/USD', 'GBP/USD': 'GBP/USD', 'USD/JPY': 'USD/JPY', 'AUD/USD': 'AUD/USD',
  Gold: 'XAU/USD', Oil: 'WTI/USD',
  AAPL: 'AAPL', TSLA: 'TSLA', AMZN: 'AMZN', GOOGL: 'GOOGL', MSFT: 'MSFT', META: 'META', NFLX: 'NFLX', NVDA: 'NVDA',
}

const DELAY_MS = Math.max(0, Number(process.env.MARKET_DELAY_MS || 20000)) // default 20s ≈ 4 candles on 5s timeframe
const BUFFER_MS = 120000
const RECONNECT_BASE_MS = 5000
const RECONNECT_MAX_MS = 120000
const RATE_LIMIT_BACKOFF_MS = 120000
const GAP_MS = 8000 // a feed silence longer than this counts as an outage gap
const STALE_MS = Math.max(DELAY_MS + 30000, 60000)

// keys read lazily so dotenv (loaded in server/index.js) is always applied first
const tdKey = () => process.env.TWELVE_DATA_KEY || ''
const fhKey = () => process.env.FINNHUB_KEY || ''

function providerLive(p) {
  if (p === 'binance') return true
  if (p === 'finnhub') return !!fhKey() // forex + commodities + stocks all live via Finnhub
  return false
}
// history for crypto = Binance klines; for everything else = Twelve Data
function historyAvailable(symbol) {
  const m = SYMBOL_MAP[symbol]
  if (!m) return false
  return m.provider === 'binance' ? true : !!tdKey()
}
function isSupported(symbol) {
  const m = SYMBOL_MAP[symbol]
  return !!m && providerLive(m.provider) && historyAvailable(symbol)
}
// live price available (ignores history key) — used for TradingView-mode trade
// resolution, which needs only the real live price, not scrollback history.
function liveSupported(symbol) {
  const m = SYMBOL_MAP[symbol]
  return !!m && providerLive(m.provider)
}
function supportedSymbols() {
  return Object.keys(SYMBOL_MAP).filter(isSupported)
}

// ---- shared ring buffers ----------------------------------------------------
const buffers = {} // ourSymbol -> [{ t, price }] ascending
for (const sym of Object.keys(SYMBOL_MAP)) buffers[sym] = []

function record(symbol, priceStr, tMs) {
  const price = Number(priceStr)
  if (!Number.isFinite(price) || !buffers[symbol]) return
  const t = tMs || Date.now()
  const buf = buffers[symbol]
  // keep ascending; ignore out-of-order older-than-last duplicates
  if (buf.length && t < buf[buf.length - 1].t) return
  buf.push({ t, price })
  const cutoff = Date.now() - BUFFER_MS
  while (buf.length && buf[0].t < cutoff) buf.shift()
}

function trimBuffer(symbol) {
  const buf = buffers[symbol]
  if (!buf) return []
  const cutoff = Date.now() - BUFFER_MS
  while (buf.length && buf[0].t < cutoff) buf.shift()
  return buf
}

// merge backfilled points (e.g. gap-fill klines) without breaking ascending order
function mergePoints(symbol, points) {
  const buf = buffers[symbol]
  if (!buf || !points || !points.length) return
  const all = buf.concat(points).sort((a, b) => a.t - b.t)
  const dedup = []
  for (const p of all) {
    if (dedup.length && Math.abs(dedup[dedup.length - 1].t - p.t) < 250) dedup[dedup.length - 1] = p
    else dedup.push(p)
  }
  const cutoff = Date.now() - BUFFER_MS
  buffers[symbol] = dedup.filter((p) => p.t >= cutoff)
}

// ---- provider WebSockets ----------------------------------------------------
let running = false
let onGap = null // callback(symbol) the server uses to refresh history after an outage gap
const conns = {} // provider -> { ws, timer, lastMsg, subs, subsToOur }

// Live subscription set: only symbols the admin has switched to the REAL feed are
// subscribed on the provider WebSockets. This keeps Finnhub on a single connection
// subscribing to just the 1-2 assets the admin toggled live (not all 14), which is
// what keeps us under the free-tier rate limit. Toggling a new asset while the
// socket is already open just sends an extra `subscribe` frame — no reconnect, so
// no reconnect storm and no 429.
const liveWanted = new Set() // our symbols admin currently wants live

function wantedFor(provider) {
  return Object.entries(SYMBOL_MAP)
    .filter(([our, m]) => m.provider === provider && liveWanted.has(our) && isSupported(our))
    .map(([our, m]) => ({ our, sym: m.sym }))
}

function setEq(a, b) {
  if (!a || !b || a.size !== b.size) return false
  for (const x of a) if (!b.has(x)) return false
  return true
}

// Safely close a WebSocket: removeAllListeners first so no 'error'/'close'
// handlers fire on a still-CONNECTING socket (close() on CONNECTING emits an
// async 'error' that try/catch cannot catch and crashes the process).
function safeClose(ws) {
  if (!ws) return
  try {
    ws.removeAllListeners()
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CLOSING) ws.close()
    else if (ws.readyState === WebSocket.CONNECTING) {
      ws.on('error', () => {}) // swallow the async close-before-connect error
      try { ws.close() } catch {}
    }
  } catch {}
}

// Binance combined miniTicker stream (crypto only). Binance streams are baked
// into the connection URL, so changing the live set means reconnecting with a
// new stream list — but Binance has no key and no rate limit, so that's fine.
function connectBinance() {
  const list = wantedFor('binance')
  if (!list.length) return
  const streams = list.map((x) => `${x.sym.toLowerCase()}@miniTicker`).join('/')
  const c = (conns.binance = conns.binance || { lastMsg: Date.now(), subs: new Set() })
  clearTimeout(c.timer); c.timer = null
  if (c.ws && (c.ws.readyState === WebSocket.OPEN || c.ws.readyState === WebSocket.CONNECTING)) return
  c.connecting = true
  const ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`)
  c.ws = ws
  const pairToOur = Object.fromEntries(list.map((x) => [x.sym, x.our]))
  ws.on('open', async () => {
    c.connecting = false
    c.attempts = 0
    c.subs = new Set(list.map((x) => x.our))
    console.log('[marketFeed] Binance WS connected:', list.map((x) => x.our).join(', '))
    // outage gap? backfill the buffer with real 1s klines so the delayed stream
    // has the real intermediate path instead of one giant bridge candle.
    if (Date.now() - c.lastMsg > GAP_MS) await fillBinanceGap(list, c.lastMsg)
    c.lastMsg = Date.now()
  })
  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw)
      const d = msg.data || msg
      if (d && d.s && d.c != null) {
        const our = pairToOur[d.s]
        if (our) record(our, d.c)
        c.lastMsg = Date.now()
      }
    } catch {}
  })
  ws.on('close', () => {
    c.connecting = false
    if (c.ws === ws) c.ws = null
    c.subs = new Set()
    scheduleReconnect('binance', connectBinance)
  })
  ws.on('error', (e) => {
    c.connecting = false
    console.warn('[marketFeed] Binance WS error:', e.message)
    try { ws.terminate() } catch {}
  })
}

// Reconcile the Binance connection to match the current liveWanted set: close it
// when no crypto symbol is live, (re)connect when the stream set changes.
function reconcileBinance() {
  const c = (conns.binance = conns.binance || { lastMsg: Date.now(), subs: new Set() })
  const wanted = wantedFor('binance')
  if (!wanted.length) {
    if (c.ws && (c.ws.readyState === WebSocket.OPEN || c.ws.readyState === WebSocket.CONNECTING)) {
      safeClose(c.ws)
      c.ws = null; c.connecting = false; c.subs = new Set()
    }
    return
  }
  const wantedOurs = new Set(wanted.map((x) => x.our))
  if (c.ws && c.ws.readyState === WebSocket.OPEN && setEq(c.subs, wantedOurs)) return
  // stream set changed (or not open) -> (re)connect with the wanted streams
  if (c.ws && (c.ws.readyState === WebSocket.OPEN || c.ws.readyState === WebSocket.CONNECTING)) {
    safeClose(c.ws)
    c.ws = null; c.connecting = false
  }
  if (!c.connecting && !c.timer) connectBinance()
}

// pull 1s klines for the outage window and merge into the buffer + ask the
// server to refresh chart history for the affected (live) symbols
async function fillBinanceGap(list, sinceMs) {
  const startTime = Math.max(sinceMs - 1000, Date.now() - 900000)
  for (const x of list) {
    try {
      const url = `https://api.binance.com/api/v3/klines?symbol=${x.sym}&interval=1s&startTime=${startTime}&limit=1000`
      const res = await fetch(url)
      if (!res.ok) continue
      const rows = await res.json()
      mergePoints(x.our, rows.map((r) => ({ t: r[6], price: +r[4] }))) // closeTime, close
      if (onGap) onGap(x.our)
    } catch (e) {
      console.warn('[marketFeed] gap fill failed', x.our, e.message)
    }
  }
}

// Finnhub trade stream (forex + commodities + stocks). Only symbols in liveWanted
// are subscribed — typically just the 1-2 assets the admin switched live — so we
// stay well under Finnhub's free-tier rate limit. Subscriptions are added/removed
// on the OPEN socket (no reconnect) when the admin toggles assets, which is what
// avoids the reconnect storm that used to trigger 429s.
function connectFinnhub() {
  const list = wantedFor('finnhub')
  if (!list.length) return
  const c = (conns.finnhub = conns.finnhub || { lastMsg: Date.now(), subs: new Set(), subsToOur: {} })
  clearTimeout(c.timer); c.timer = null
  if (c.ws && (c.ws.readyState === WebSocket.OPEN || c.ws.readyState === WebSocket.CONNECTING)) return
  c.connecting = true
  c.lastStatus = null
  c.subs = new Set()
  c.subsToOur = {}
  const ws = new WebSocket(`wss://ws.finnhub.io?token=${fhKey()}`)
  c.ws = ws
  ws.on('open', () => {
    c.connecting = false
    c.attempts = 0
    c.lastStatus = null
    c.subs = new Set()
    c.subsToOur = {}
    console.log('[marketFeed] Finnhub WS connected:', list.map((x) => x.our).join(', '))
    for (const x of list) {
      ws.send(JSON.stringify({ type: 'subscribe', symbol: x.sym }))
      c.subs.add(x.sym)
      c.subsToOur[x.sym] = x.our
    }
    c.lastMsg = Date.now()
  })
  ws.on('message', (raw) => {
    try {
      const m = JSON.parse(raw)
      if (m.type === 'trade' && Array.isArray(m.data)) {
        for (const t of m.data) {
          const our = c.subsToOur[t.s]
          if (our) record(our, t.p, t.t)
        }
        c.lastMsg = Date.now()
      }
    } catch {}
  })
  ws.on('unexpected-response', (_req, res) => {
    c.lastStatus = res.statusCode
    if (res.statusCode === 429) {
      console.warn(`[marketFeed] Finnhub WS rate-limited (429). Backing off ${Math.round(RATE_LIMIT_BACKOFF_MS / 1000)}s.`)
    } else {
      console.warn('[marketFeed] Finnhub WS unexpected response:', res.statusCode)
    }
    try { ws.terminate() } catch {}
  })
  ws.on('close', () => {
    c.connecting = false
    if (c.ws === ws) c.ws = null
    c.subs = new Set()
    c.subsToOur = {}
    scheduleReconnect('finnhub', connectFinnhub, c.lastStatus === 429 ? RATE_LIMIT_BACKOFF_MS : undefined)
  })
  ws.on('error', (e) => {
    c.connecting = false
    if (/429/.test(e.message || '')) c.lastStatus = 429
    if (c.lastStatus === 429) console.warn('[marketFeed] Finnhub WS rate-limited (429). Backing off.')
    else console.warn('[marketFeed] Finnhub WS error:', e.message)
    try { ws.terminate() } catch {}
  })
}

// Reconcile the Finnhub connection to match liveWanted. When the socket is open
// we add/remove subscriptions in place (NO reconnect); we only connect/close when
// the first symbol goes live / the last one goes offline.
function reconcileFinnhub() {
  if (!fhKey()) return
  const c = (conns.finnhub = conns.finnhub || { lastMsg: Date.now(), subs: new Set(), subsToOur: {} })
  const wanted = wantedFor('finnhub')
  if (!wanted.length) {
    if (c.ws && (c.ws.readyState === WebSocket.OPEN || c.ws.readyState === WebSocket.CONNECTING)) {
      safeClose(c.ws)
      c.ws = null; c.connecting = false; c.subs = new Set(); c.subsToOur = {}
    }
    return
  }
  // socket not open -> connect (it subscribes to all wanted on open), unless a
  // reconnect/backoff is already pending (let it fire and pick up the latest set)
  if (!c.ws || c.ws.readyState !== WebSocket.OPEN) {
    // a closed/closing socket here means safeClose ran above and already reset
    // c.connecting; if it's still true there's a pending connect — let it fire
    if (!c.connecting && !c.timer) connectFinnhub()
    return
  }
  // socket open -> diff subscriptions in place (NO reconnect)
  const ws = c.ws
  const wantedSyms = new Set(wanted.map((x) => x.sym))
  for (const x of wanted) {
    if (!c.subs.has(x.sym)) {
      ws.send(JSON.stringify({ type: 'subscribe', symbol: x.sym }))
      c.subs.add(x.sym)
      c.subsToOur[x.sym] = x.our
    }
  }
  for (const sym of [...c.subs]) {
    if (!wantedSyms.has(sym)) {
      try { ws.send(JSON.stringify({ type: 'unsubscribe', symbol: sym })) } catch {}
      c.subs.delete(sym)
      delete c.subsToOur[sym]
    }
  }
}

function scheduleReconnect(provider, fn, explicitDelay) {
  if (!running) return
  const c = (conns[provider] = conns[provider] || {})
  if (c) clearTimeout(c.timer)
  c.attempts = (c.attempts || 0) + 1
  const backoff = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * Math.pow(2, Math.max(0, c.attempts - 1)))
  c.timer = setTimeout(fn, explicitDelay != null ? explicitDelay : backoff)
}

function start() {
  if (running) return
  running = true
  reconcileBinance()
  reconcileFinnhub()
}

function stop() {
  running = false
  for (const p of Object.keys(conns)) {
    const c = conns[p]
    clearTimeout(c.timer)
    safeClose(c.ws)
    c.ws = null
    c.subs = new Set()
    c.subsToOur = {}
    c.timer = null
  }
  console.log('[marketFeed] all live feeds stopped')
}

// Admin toggled a single asset live -> add it to the wanted set and reconcile.
// Opens the provider WS if this is the first live asset, otherwise just sends a
// `subscribe` on the already-open socket (no reconnect, no extra rate-limit use).
function addLiveSymbol(symbol) {
  if (!SYMBOL_MAP[symbol] || !isSupported(symbol)) return false
  liveWanted.add(symbol)
  if (!running) running = true
  reconcileBinance()
  reconcileFinnhub()
  return true
}

// Admin toggled a single asset off -> drop it and unsubscribe (or close the WS
// if no live symbols remain).
function removeLiveSymbol(symbol) {
  liveWanted.delete(symbol)
  if (running) {
    reconcileBinance()
    reconcileFinnhub()
  }
}

// Bulk replace the wanted set (used on boot to restore persisted live assets).
function setLiveWanted(symbols) {
  liveWanted.clear()
  for (const s of symbols || []) {
    if (SYMBOL_MAP[s] && isSupported(s)) liveWanted.add(s)
  }
  if (!running) running = true
  reconcileBinance()
  reconcileFinnhub()
}

function setOnGap(fn) {
  onGap = fn
}

// ---- reads ------------------------------------------------------------------
function livePrice(symbol) {
  const buf = trimBuffer(symbol)
  if (!buf.length) return null
  const last = buf[buf.length - 1]
  if (Date.now() - last.t > STALE_MS) return null
  return last.price
}
function delayedPrice(symbol, delayMs = DELAY_MS) {
  const buf = trimBuffer(symbol)
  if (!buf || !buf.length) return null
  const latest = buf[buf.length - 1]
  if (Date.now() - latest.t > STALE_MS) return null
  const target = Date.now() - delayMs
  if (buf[0].t >= target) return buf[0].price
  let chosen = buf[0].price
  for (let i = 0; i < buf.length; i++) {
    if (buf[i].t <= target) chosen = buf[i].price
    else break
  }
  return chosen
}

function waitForLivePrice(symbol, timeoutMs = 10000) {
  const started = Date.now()
  return new Promise((resolve) => {
    const tick = () => {
      if (livePrice(symbol) != null) return resolve(true)
      if (Date.now() - started >= timeoutMs) return resolve(false)
      setTimeout(tick, 250)
    }
    tick()
  })
}

// ---- historical backfill ----------------------------------------------------
const TF_SEC = {
  '5s': 5, '10s': 10, '15s': 15, '30s': 30,
  '1m': 60, '2m': 120, '3m': 180, '5m': 300, '10m': 600,
  '15m': 900, '30m': 1800, '1h': 3600, '4h': 14400, '1d': 86400,
}

// aggregate normalized rows [{t(sec),o,h,l,c,v}] into our timeframe buckets
function aggregate(rows, tfSec, count) {
  const m = new Map()
  for (const r of rows) {
    const b = Math.floor(r.t / tfSec) * tfSec
    const cur = m.get(b)
    if (!cur) m.set(b, { time: b, open: r.o, high: r.h, low: r.l, close: r.c, volume: r.v || 0 })
    else {
      if (r.h > cur.high) cur.high = r.h
      if (r.l < cur.low) cur.low = r.l
      cur.close = r.c
      cur.volume += r.v || 0
    }
  }
  return Array.from(m.values()).sort((a, b) => a.time - b.time).slice(-count)
}

// --- Binance klines (crypto) ---
const BINANCE_DIRECT = new Set(['1m', '3m', '5m', '15m', '30m', '1h', '4h', '1d'])
function binanceSource(tf) {
  if (BINANCE_DIRECT.has(tf)) return tf
  if (TF_SEC[tf] < 60) return '1s'
  return '1m'
}
async function fetchBinanceKlines(pair, interval) {
  const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${interval}&limit=1000`)
  if (!res.ok) return null
  const rows = await res.json()
  return rows.map((r) => ({ t: Math.floor(r[0] / 1000), o: +r[1], h: +r[2], l: +r[3], c: +r[4], v: +r[5] }))
}
async function backfillBinance(symbol, count) {
  const pair = SYMBOL_MAP[symbol].sym
  const tfs = Object.keys(TF_SEC)
  const needed = new Set(tfs.map(binanceSource))
  const raw = {}
  await Promise.all([...needed].map(async (iv) => { try { raw[iv] = await fetchBinanceKlines(pair, iv) } catch {} }))
  const out = {}
  for (const tf of tfs) { const iv = binanceSource(tf); if (raw[iv]) out[tf] = aggregate(raw[iv], TF_SEC[tf], count) }
  return Object.keys(out).length ? out : null
}

// --- Twelve Data time_series (forex / commodities / stocks) ---
// Free tier is capped at 8 credits/min, so we fetch only THREE source intervals
// per symbol (1min, 1h, 1day) and aggregate everything else from them. Twelve
// Data has no sub-minute history, so 5s/10s/15s/30s have no real scrollback
// (they build forward from live ticks). 1m+ are real.
function tdSource(tf) {
  if (tf === '1d') return '1day'
  if (tf === '1h' || tf === '4h') return '1h' // 4h aggregated from 1h
  if (TF_SEC[tf] >= 60) return '1min' // 1m..30m aggregated from 1min
  return null // sub-minute: unavailable
}
async function fetchTdSeries(sym, interval) {
  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(sym)}&interval=${interval}&outputsize=500&apikey=${tdKey()}&timezone=UTC`
  const res = await fetch(url)
  if (!res.ok) return null
  const data = await res.json()
  if (!data || !Array.isArray(data.values)) return null // status:'error' etc.
  return data.values.map((v) => ({
    t: Math.floor(Date.parse(v.datetime.replace(' ', 'T') + 'Z') / 1000),
    o: +v.open, h: +v.high, l: +v.low, c: +v.close, v: +(v.volume || 0),
  }))
}
async function backfillTwelve(symbol, count) {
  const sym = TD_HISTORY_SYM[symbol]
  if (!sym) return null
  const tfs = Object.keys(TF_SEC)
  const needed = new Set(tfs.map(tdSource).filter(Boolean))
  const raw = {}
  for (const iv of needed) { try { raw[iv] = await fetchTdSeries(sym, iv) } catch {} } // serial: respect TD rate limit
  const out = {}
  for (const tf of tfs) { const iv = tdSource(tf); if (iv && raw[iv]) out[tf] = aggregate(raw[iv], TF_SEC[tf], count) }
  return Object.keys(out).length ? out : null
}

async function backfillAll(symbol, count = 320) {
  const m = SYMBOL_MAP[symbol]
  if (!m) return null
  return m.provider === 'binance' ? backfillBinance(symbol, count) : backfillTwelve(symbol, count)
}


function providerInfo(symbol) {
  const m = SYMBOL_MAP[symbol]
  if (!m) return { symbol, configured: false, supported: false, missing: ['symbol map'] }
  const missing = []
  if (m.provider === 'finnhub' && !fhKey()) missing.push('FINNHUB_KEY')
  if (m.provider !== 'binance' && !tdKey()) missing.push('TWELVE_DATA_KEY')
  const liveProvider = m.provider === 'binance' ? 'Binance WebSocket' : 'Finnhub WebSocket'
  const historyProvider = m.provider === 'binance' ? 'Binance REST klines' : 'Twelve Data time_series'
  const buf = buffers[symbol] || []
  return {
    symbol,
    configured: true,
    provider: m.provider,
    providerSymbol: m.sym,
    liveProvider,
    historyProvider,
    supported: isSupported(symbol),
    liveSupported: liveSupported(symbol),
    historyAvailable: historyAvailable(symbol),
    missing,
    delayMs: DELAY_MS,
    bufferedTicks: buf.length,
    lastTickAt: buf.length ? buf[buf.length - 1].t : null,
  }
}
function allConfiguredSymbols() {
  return Object.keys(SYMBOL_MAP)
}

function getLiveStatus() {
  return Object.keys(SYMBOL_MAP)
    .filter((s) => liveWanted.has(s))
    .map((s) => {
      const buf = buffers[s] || []
      const last = buf[buf.length - 1]
      return {
        symbol: s,
        provider: SYMBOL_MAP[s]?.provider,
        lastTickAt: last ? last.t : null,
        bufferedTicks: buf.length,
        livePrice: last ? last.price : null,
      }
    })
}

module.exports = {
  SYMBOL_MAP,
  DELAY_MS,
  isSupported,
  liveSupported,
  supportedSymbols,
  allConfiguredSymbols,
  providerInfo,
  getLiveStatus,
  start,
  stop,
  addLiveSymbol,
  removeLiveSymbol,
  setLiveWanted,
  setOnGap,
  livePrice,
  delayedPrice,
  waitForLivePrice,
  backfillAll,
  isRunning: () => running,
}
