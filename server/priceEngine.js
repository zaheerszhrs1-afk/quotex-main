// Server-side shared price engine.
//
// Design (my own, not the literal prompt):
//  - Every asset has an independent momentum-based random walk so each chart
//    looks different and moves smoothly (velocity carries between ticks, with
//    gentle mean-reversion to a slowly drifting anchor — no jagged jumps).
//  - On boot we pre-seed a long candle history per (asset, timeframe) so the
//    chart is "long from behind" and the user can scroll back.
//  - One price per asset feeds every timeframe's forming candle, so all
//    timeframes stay consistent in real time.
//
// The engine is pure (no socket dependency); server/index.js drives it.

const { ASSETS, TIMEFRAMES } = require('../lib/assetsConfig')

const HISTORY_LEN = 320 // candles kept per (asset, timeframe)

// Future-plan buffer: the engine pre-generates each asset's price path a little
// into the future (memory only, no DB). Users see it in real time; admins can
// see/steer it ahead. One plan step == one live tick.
const PLAN_STEP_MS = 250
const PLAN_AHEAD_MS = 90000 // 90s lookahead

// --- helpers ---------------------------------------------------------------
function gaussian() {
  // Box–Muller
  let u = 0,
    v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

function bucketStart(tsSec, tfSec) {
  return Math.floor(tsSec / tfSec) * tfSec
}

function nowSecFrom(ms) {
  return Math.floor(ms / 1000)
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v))
}

// Walk tuning. Pulled out so scripts/sim-candles.js can search for values that
// keep candles solid (high body-to-range ratio) and clean across ALL timeframes
// — real-Quotex-like — while staying bounded (no runaway crash).
const DEFAULT_PARAMS = {
  // live walk (per ~250ms tick)
  velPersist: 0.88, // velocity momentum (kept below 1 so runs can breathe/reverse)
  velNoise: 0.11, // per-tick random kick
  anchorDrift: 0.0045, // per-tick anchor wander
  anchorReturn: 0.006, // per-tick pull of anchor back toward base (bounds drift)
  pricePull: 0.006, // per-tick pull of price toward anchor
  // seed backfill (per sub-step), matched to the live style so scrollback
  // candles look the same — solid bodies, modest wicks — on first load
  seedPersist: 0.78,
  seedNoise: 0.12,
  seedPull: 0.024,
}

class PriceEngine {
  constructor(params) {
    this.assets = {} // symbol -> live state
    this.meta = {} // symbol -> { name, category, payout, digits }
    this.history = {} // symbol -> { tf -> [candles] }
    this.forming = {} // symbol -> { tf -> candle }
    this.plan = {} // symbol -> { startT, prices:[], head:{price,velocity,anchor} }
    this.overrides = {} // symbol -> [{ tf, direction, target, bStartMs, bEndMs, createdAt }]
    this.autoTarget = {} // symbol -> price the auto-profit engine is steering toward (or null)
    this.autoPlan = {} // symbol -> { target, deadlineMs, createdAt, phase, real }
    this.liveSet = new Set() // symbols driven by a real external feed (international mode)
    this.external = {} // symbol -> externally supplied price (client-facing, delayed)
    this._liveReady = new Set() // live symbols whose REAL history is loaded (safe to stream)
    this.params = { ...DEFAULT_PARAMS, ...(params || {}) }
  }

  // --- international (real-feed) mode -----------------------------------------
  // When a symbol is "live", its price comes from an external real feed (pushed
  // in via setExternalPrice) instead of the simulated plan. Admin steering/auto
  // is bypassed for these — it's the genuine market.
  setLive(symbol, on) {
    if (!this.assets[symbol]) return
    if (on) {
      this.liveSet.add(symbol)
      this._liveReady.delete(symbol) // frozen until real history is loaded
      delete this.external[symbol]
    } else {
      this.liveSet.delete(symbol)
      this._liveReady.delete(symbol)
      delete this.external[symbol]
      // leaving live mode: wipe the REAL history and reseed it with simulated
      // candles so no real data lingers, then resume the simulated walk.
      this._reseedSimulated(symbol)
      this._resyncPlan(symbol)
    }
  }

  // Replace history + forming with fresh SIMULATED candles at the current price
  // (used when an asset leaves live mode, so real candles fully disappear).
  _reseedSimulated(symbol) {
    const a = this.assets[symbol]
    if (!a) return
    const nowSec = Math.floor(Date.now() / 1000)
    for (const [tf, sec] of Object.entries(TIMEFRAMES)) {
      this.history[symbol][tf] = this._seedHistory(symbol, tf, sec, nowSec)
      const last = this.history[symbol][tf][this.history[symbol][tf].length - 1]
      const t = bucketStart(nowSec, sec)
      const open = last ? last.close : a.price
      this.forming[symbol][tf] = { time: t, open, high: open, low: open, close: open, volume: 0 }
    }
    a.anchor = a.price // _seedHistory wanders the anchor; pin it back
  }
  isLive(symbol) {
    return this.liveSet.has(symbol)
  }
  setExternalPrice(symbol, price) {
    if (price != null && Number.isFinite(price)) this.external[symbol] = price
  }

  // Replace an asset's candle history with REAL Binance klines (per timeframe),
  // so scrollback is genuine market data instead of a synthetic reseed. The
  // forming candle continues at the current bucket from the last real close; the
  // live forward stream (delayed feed) carries on from there.
  applyRealHistory(symbol, byTf) {
    const a = this.assets[symbol]
    if (!a || !this.history[symbol] || !byTf) return
    const nowSec = Math.floor(Date.now() / 1000)
    let anchorClose = null
    let fallbackClose = null
    let fallbackSec = Infinity
    const loadedTfs = new Set()
    for (const [tf, candles] of Object.entries(byTf)) {
      if (!this.history[symbol][tf] || !candles || !candles.length) continue
      const tfSec = TIMEFRAMES[tf]
      const formingBucket = bucketStart(nowSec, tfSec)
      const hist = candles
        .filter((c) => c.time < formingBucket) // drop the partial current bucket
        .map((c) => ({
          time: c.time,
          open: this._round(symbol, c.open),
          high: this._round(symbol, c.high),
          low: this._round(symbol, c.low),
          close: this._round(symbol, c.close),
          volume: Math.round(c.volume) || 0,
        }))
        .slice(-HISTORY_LEN)
      if (!hist.length) continue
      this.history[symbol][tf] = hist
      const last = hist[hist.length - 1]
      this.forming[symbol][tf] = {
        time: formingBucket,
        open: last.close,
        high: last.close,
        low: last.close,
        close: last.close,
        volume: 0,
      }
      if (tf === '5s') anchorClose = last.close
      if (tfSec < fallbackSec) {
        fallbackSec = tfSec
        fallbackClose = last.close
      }
      loadedTfs.add(tf)
    }
    if (anchorClose == null) anchorClose = fallbackClose
    if (anchorClose == null) return
    if (anchorClose != null) {
      a.price = anchorClose
      a.anchor = anchorClose
      a.base = anchorClose
      a.minPrice = anchorClose * 0.5
      for (const [tf, sec] of Object.entries(TIMEFRAMES)) {
        if (loadedTfs.has(tf)) continue
        this.history[symbol][tf] = this._seedHistory(symbol, tf, sec, nowSec)
        const last = this.history[symbol][tf][this.history[symbol][tf].length - 1]
        const t = bucketStart(nowSec, sec)
        const open = last ? last.close : anchorClose
        this.forming[symbol][tf] = { time: t, open, high: open, low: open, close: open, volume: 0 }
      }
      a.price = anchorClose
      a.anchor = anchorClose
    }
    this._liveReady.add(symbol) // real history loaded — safe to stream live now
  }

  // rebuild the future plan starting from the current price (used when leaving
  // live mode so simulated candles continue from where the real feed left off)
  _resyncPlan(symbol) {
    const a = this.assets[symbol]
    if (!a) return
    const now = Date.now()
    this.plan[symbol] = {
      startT: Math.floor(now / PLAN_STEP_MS) * PLAN_STEP_MS,
      prices: [a.price],
      head: this._makeHead(a.price, 0, a.price),
    }
    this.overrides[symbol] = []
    this.autoTarget[symbol] = null
    this.autoPlan[symbol] = null
    this._extendPlan(symbol, now + PLAN_AHEAD_MS)
  }

  // assetDefs: array shaped like assetsConfig.ASSETS (optionally from DB).
  init(assetDefs) {
    const defs = assetDefs && assetDefs.length ? assetDefs : ASSETS
    const nowSec = Math.floor(Date.now() / 1000)

    for (const def of defs) {
      const symbol = def.symbol
      const vol = def.volatility || def.basePrice * 0.0008
      this.assets[symbol] = {
        price: def.basePrice,
        base: def.basePrice,
        anchor: def.basePrice,
        velocity: 0,
        volatility: vol,
        minPrice: def.basePrice * 0.5,
      }
      this.meta[symbol] = {
        symbol,
        name: def.name || symbol,
        category: def.category || 'Currencies',
        payout: def.payout || 80,
        digits: def.digits != null ? def.digits : 2,
      }
      this.history[symbol] = {}
      this.forming[symbol] = {}

      for (const [tf, sec] of Object.entries(TIMEFRAMES)) {
        this.history[symbol][tf] = this._seedHistory(symbol, tf, sec, nowSec)
        // seed forming candle for the current bucket
        const last = this.history[symbol][tf][this.history[symbol][tf].length - 1]
        const t = bucketStart(nowSec, sec)
        const open = last ? last.close : def.basePrice
        this.forming[symbol][tf] = {
          time: t,
          open,
          high: open,
          low: open,
          close: open,
          volume: 0,
        }
      }
      // start live price at the most recent close so it's continuous
      const ref = this.history[symbol]['5s']
      if (ref && ref.length) {
        this.assets[symbol].price = ref[ref.length - 1].close
        this.assets[symbol].anchor = this.assets[symbol].price
      }
      // pre-fill the future plan buffer for this asset
      this._initPlan(symbol)
    }
  }

  _seedHistory(symbol, tf, tfSec, nowSec) {
    const a = this.assets[symbol]
    // candle-level walk; range scales with sqrt(timeframe) for realistic shape
    const tfScale = Math.sqrt(tfSec)
    let p = a.price
    let vel = 0
    let run = 0
    let lastDir = 0
    const phase = Math.random() * Math.PI * 2
    const candles = []
    const firstBucket = bucketStart(nowSec, tfSec) - HISTORY_LEN * tfSec
    for (let i = 0; i < HISTORY_LEN; i++) {
      const time = firstBucket + i * tfSec
      const open = p
      let high = p
      let low = p
      const P = this.params
      const steps = 12 // more sub-steps => smoother wicks/bodies
      for (let k = 0; k < steps; k++) {
        const micro = Math.sin((i * steps + k) / 4.5 + phase) * a.volatility * tfScale * 0.018
        vel = vel * P.seedPersist + gaussian() * a.volatility * tfScale * P.seedNoise + micro
        const dir = Math.sign(vel)
        run = dir && dir === lastDir ? run + 1 : 0
        lastDir = dir || lastDir
        if (run > 5 && dir) vel -= dir * a.volatility * tfScale * Math.min(0.12, (run - 5) * 0.015)
        const pull = (a.anchor - p) * P.seedPull
        p = Math.max(p + vel + pull, a.minPrice)
        const wick = a.volatility * tfScale * (0.010 + Math.random() * 0.020)
        if (p + wick > high) high = p + wick
        if (p - wick < low) low = p - wick
      }
      // slowly wander the anchor so there are visible trends
      a.anchor += gaussian() * a.volatility * tfScale * 0.07
      const close = p
      candles.push({
        time,
        open: this._round(symbol, open),
        high: this._round(symbol, high),
        low: this._round(symbol, low),
        close: this._round(symbol, close),
        volume: Math.round(200 + Math.random() * 800),
      })
    }
    a.anchor = p
    return candles
  }

  _round(symbol, v) {
    const d = this.meta[symbol]?.digits ?? 2
    return Number(v.toFixed(d))
  }

  // Advance every asset one tick. Returns broadcast payloads.
  tick() {
    const nowMs = Date.now()
    const nowSec = Math.floor(nowMs / 1000)
    const updates = [] // { symbol, price, time, digits, candles:{tf:{candle,closed}} }

    for (const symbol of Object.keys(this.assets)) {
      const a = this.assets[symbol]
      if (this.liveSet.has(symbol)) {
        // International mode: genuine market only — no plan, no steering, and
        // NO synthetic candles. While the real history is still loading, freeze
        // the asset (skip it entirely) so a fake/jumpy candle is never emitted.
        if (!this._liveReady.has(symbol)) continue
        const ext = this.external[symbol]
        a.price = ext != null ? Math.max(ext, a.minPrice) : Math.max(a.price, a.minPrice)
      } else {
        // The price comes from the future-plan buffer: keep it filled ahead,
        // realize the value planned for "now", then drop consumed points. The plan
        // itself is generated by the same random walk (see _stepPlanHead), so the
        // chart looks identical — but admins can pre-steer it (setCandleOverride).
        if (!this.plan[symbol]) this._initPlan(symbol)
        this._extendPlan(symbol, nowMs + PLAN_AHEAD_MS)
        a.price = Math.max(this._planPriceAt(symbol, nowMs), a.minPrice)
        this._trimPlan(symbol, nowMs)
      }
      const price = this._round(symbol, a.price)

      const candles = {}
      for (const [tf, sec] of Object.entries(TIMEFRAMES)) {
        const t = bucketStart(nowSec, sec)
        let cur = this.forming[symbol][tf]
        let closed = null
        if (!cur || cur.time !== t) {
          // close the previous forming candle into history
          if (cur) {
            this.history[symbol][tf].push(cur)
            if (this.history[symbol][tf].length > HISTORY_LEN)
              this.history[symbol][tf].shift()
            closed = cur
          }
          cur = {
            time: t,
            open: price,
            high: price,
            low: price,
            close: price,
            volume: 0,
          }
          this.forming[symbol][tf] = cur
        } else {
          cur.close = price
          // scale wick with sqrt(tfSec) to match seed-history proportions —
          // without this, 5s and 1d get the same wick size, which looks wrong
          const tfWick = a.volatility * Math.sqrt(sec) * (0.010 + Math.random() * 0.020)
          const hi = this._round(symbol, price + tfWick * Math.random())
          const lo = this._round(symbol, price - tfWick * Math.random())
          if (hi > cur.high) cur.high = hi
          if (lo < cur.low) cur.low = lo
          cur.volume += Math.round(Math.random() * 30)
        }
        candles[tf] = { candle: cur, closed }
      }

      updates.push({
        symbol,
        price,
        time: nowSec,
        digits: this.meta[symbol].digits,
        candles,
      })
    }
    return updates
  }

  getPrice(symbol) {
    const a = this.assets[symbol]
    return a ? this._round(symbol, a.price) : null
  }

  // round a raw value to the asset's display digits (used by the resolver when
  // pricing a trade from the real live feed in TradingView mode)
  round(symbol, v) {
    return v == null ? null : this._round(symbol, v)
  }

  // history + forming for a chart subscription
  getSeries(symbol, tf) {
    if (!this.history[symbol] || !this.history[symbol][tf]) return null
    return {
      symbol,
      timeframe: tf,
      digits: this.meta[symbol].digits,
      candles: this.history[symbol][tf].slice(),
      forming: this.forming[symbol][tf],
    }
  }

  // ---- future-plan buffer ------------------------------------------------

  _initPlan(symbol) {
    const a = this.assets[symbol]
    const startT = Math.floor(Date.now() / PLAN_STEP_MS) * PLAN_STEP_MS
    this.plan[symbol] = {
      startT,
      prices: [a.price],
      head: this._makeHead(a.price, 0, a.anchor),
    }
    this.overrides[symbol] = []
    this._extendPlan(symbol, Date.now() + PLAN_AHEAD_MS)
  }

  _makeHead(price, velocity = 0, anchor = price) {
    return {
      price,
      velocity,
      anchor,
      vol: 1,
      phase: Math.random() * Math.PI * 2,
      run: 0,
      lastDir: 0,
    }
  }

  _ensureHeadTexture(h) {
    if (h.vol == null) h.vol = 1
    if (h.phase == null) h.phase = Math.random() * Math.PI * 2
    if (h.run == null) h.run = 0
    if (h.lastDir == null) h.lastDir = 0
  }

  _naturalMove(symbol, nextT, anchorTarget) {
    const a = this.assets[symbol]
    const P = this.params
    const h = this.plan[symbol].head
    this._ensureHeadTexture(h)

    h.vol = clamp(h.vol * 0.985 + (0.85 + Math.abs(gaussian()) * 0.45) * 0.015, 0.65, 1.75)
    h.anchor +=
      gaussian() * a.volatility * P.anchorDrift +
      ((anchorTarget ?? a.base) - h.anchor) * P.anchorReturn

    const micro = Math.sin(nextT / 900 + h.phase) * a.volatility * 0.035
    let nextVelocity = h.velocity * P.velPersist + gaussian() * a.volatility * P.velNoise * h.vol + micro
    const dir = Math.sign(nextVelocity)
    h.run = dir && dir === h.lastDir ? h.run + 1 : 0
    h.lastDir = dir || h.lastDir
    if (h.run > 18 && dir) {
      nextVelocity -= dir * a.volatility * Math.min(0.22, (h.run - 18) * 0.012)
    }

    h.velocity = nextVelocity
    h.price = Math.max(h.price + h.velocity + (h.anchor - h.price) * P.pricePull, a.minPrice)
    return h.price
  }

  // advance the plan's "head" one 250ms step using the same random walk as the
  // live engine, so planned (future) candles look identical to realized ones
  _stepPlanHead(symbol, nextT) {
    const a = this.assets[symbol]
    const h = this.plan[symbol].head
    this._ensureHeadTexture(h)
    const at = this.autoTarget[symbol]
    if (at != null) {
      const ap = this.autoPlan[symbol] || {}
      const deadlineMs = Number(ap.deadlineMs) || nextT + 15000
      if (nextT <= deadlineMs + PLAN_STEP_MS) {
        // Auto-profit mode: arrive near the losing price at the trade expiry,
        // but do it as a live drift with momentum and tapered noise. This avoids
        // the old "hit target and freeze flat" look while still landing on time.
        const totalMs = Math.max(PLAN_STEP_MS, deadlineMs - (ap.createdAt || nextT - 15000))
        const remainingMs = Math.max(PLAN_STEP_MS, deadlineMs - nextT)
        const stepsLeft = Math.max(1, remainingMs / PLAN_STEP_MS)
        const progress = clamp(1 - remainingMs / totalMs, 0, 1)
        const diff = at - h.price
        const perStep = diff / stepsLeft
        const noiseScale = 0.18 * (1 - progress) + 0.045
        const wave = Math.sin(nextT / 850 + (ap.phase || h.phase)) * a.volatility * 0.045 * (1 - progress)
        const pullback =
          -Math.sign(diff || h.velocity || 1) *
          Math.sin(progress * Math.PI * 3 + (ap.phase || 0)) *
          a.volatility *
          0.09 *
          (1 - progress)
        const noise = gaussian() * a.volatility * noiseScale
        const maxStep = Math.max(a.volatility * 0.42, Math.abs(perStep) * 2.15)

        h.velocity = h.velocity * 0.72 + perStep * 0.7 + noise + wave + pullback
        h.price = Math.max(h.price + clamp(h.velocity + perStep * 0.35, -maxStep, maxStep), a.minPrice)

        // Last moments: remove almost all randomness so expiry resolves on the
        // intended side without drawing a fake-looking vertical spike.
        if (remainingMs <= PLAN_STEP_MS * 4) {
          const settle = (at - h.price) * 0.72
          h.price = Math.max(h.price + settle + gaussian() * a.volatility * 0.01, a.minPrice)
          h.velocity = settle * 0.25
        }
      } else {
        // After the decisive expiry point, go back to a normal walk from that
        // area instead of pinning the chart flat while the resolver catches up.
        return this._naturalMove(symbol, nextT, at)
      }
    } else {
      return this._naturalMove(symbol, nextT)
    }
    return h.price
  }

  _extendPlan(symbol, untilT) {
    const plan = this.plan[symbol]
    if (!plan) return
    let lastT = plan.startT + (plan.prices.length - 1) * PLAN_STEP_MS
    let guard = 0
    while (lastT < untilT && guard < 100000) {
      lastT += PLAN_STEP_MS
      plan.prices.push(this._stepPlanHead(symbol, lastT))
      guard++
    }
  }

  _planPriceAt(symbol, t) {
    const plan = this.plan[symbol]
    if (!plan || !plan.prices.length) return this.assets[symbol].price
    let idx = Math.floor((t - plan.startT) / PLAN_STEP_MS)
    if (idx < 0) idx = 0
    if (idx >= plan.prices.length) idx = plan.prices.length - 1
    return plan.prices[idx]
  }

  _planVelocityAt(symbol, t) {
    const plan = this.plan[symbol]
    if (!plan || plan.prices.length < 2) return 0
    let idx = Math.floor((t - plan.startT) / PLAN_STEP_MS)
    idx = clamp(idx, 1, plan.prices.length - 1)
    return plan.prices[idx] - plan.prices[idx - 1]
  }

  // drop already-consumed points (keep a few for safety) to bound memory
  _trimPlan(symbol, nowMs) {
    const plan = this.plan[symbol]
    if (!plan) return
    const idx = Math.floor((nowMs - plan.startT) / PLAN_STEP_MS)
    const keepPast = 8
    if (idx > keepPast) {
      const drop = idx - keepPast
      plan.prices.splice(0, drop)
      plan.startT += drop * PLAN_STEP_MS
    }
  }

  // Admin steer: force a future candle's close UP/DOWN or to an exact target.
  // Rewrites the plan across the candle window (open->close glide + tapering
  // noise so it lands exactly), then continues the walk from the forced close.
  setCandleOverride(symbol, opts = {}) {
    if (!this.assets[symbol] || !this.plan[symbol]) return null
    const { tf = '1m', direction = 'up', strength = 3, target = null, which = 'next' } = opts
    const a = this.assets[symbol]
    const tfSec = TIMEFRAMES[tf] || 60
    const now = Date.now()
    const curBucketSec = bucketStart(nowSecFrom(now), tfSec)
    const bStartSec = which === 'current' ? curBucketSec : curBucketSec + tfSec
    const bStartMs = bStartSec * 1000
    const bEndMs = bStartMs + tfSec * 1000

    // ensure the plan covers the whole target candle
    this._extendPlan(symbol, bEndMs + PLAN_STEP_MS)
    const plan = this.plan[symbol]

    const fromMs = Math.max(bStartMs, now + PLAN_STEP_MS) // never touch the realized past
    const open = this._planPriceAt(symbol, bStartMs)
    const startPrice = this._planPriceAt(symbol, fromMs)

    let close
    if (target != null && Number.isFinite(Number(target))) {
      close = Number(target)
    } else {
      const dir = direction === 'down' ? -1 : 1
      const move = a.volatility * Math.sqrt(tfSec) * (Number(strength) || 3) * 0.9
      close = startPrice + dir * move
    }
    close = Math.max(close, a.minPrice)

    const startIdx = Math.max(0, Math.ceil((fromMs - plan.startT) / PLAN_STEP_MS))
    const endIdx = Math.floor((bEndMs - plan.startT) / PLAN_STEP_MS)
    const span = Math.max(1, endIdx - startIdx)
    for (let i = startIdx; i <= endIdx && i < plan.prices.length; i++) {
      const frac = (i - startIdx) / span
      const line = startPrice + (close - startPrice) * frac
      const noise = gaussian() * a.volatility * 0.6 * (1 - frac) // taper so it lands clean
      plan.prices[i] = Math.max(line + noise, a.minPrice)
    }
    if (endIdx >= 0 && endIdx < plan.prices.length) plan.prices[endIdx] = close

    // continue the natural walk from the forced close
    if (endIdx + 1 < plan.prices.length) plan.prices.length = endIdx + 1
    plan.head = this._makeHead(close, 0, close)
    this._extendPlan(symbol, now + PLAN_AHEAD_MS)

    this.overrides[symbol] = (this.overrides[symbol] || []).filter((o) => o.bEndMs > now)
    this.overrides[symbol].push({
      tf,
      direction: target != null ? 'target' : direction,
      target: this._round(symbol, close),
      bStartMs,
      bEndMs,
      createdAt: now,
    })
    return { symbol, tf, open: this._round(symbol, open), close: this._round(symbol, close), bStartMs, bEndMs }
  }

  // Cancel pending overrides: regenerate a natural plan from the current price.
  clearOverrides(symbol) {
    if (!this.assets[symbol] || !this.plan[symbol]) return
    const a = this.assets[symbol]
    const now = Date.now()
    const cur = this._planPriceAt(symbol, now)
    const velocity = this._planVelocityAt(symbol, now)
    this.plan[symbol] = {
      startT: Math.floor(now / PLAN_STEP_MS) * PLAN_STEP_MS,
      prices: [cur],
      head: this._makeHead(cur, velocity, a.anchor),
    }
    this.overrides[symbol] = []
    this._extendPlan(symbol, now + PLAN_AHEAD_MS)
  }

  // Return true if an admin candle override is currently active on this symbol
  // and covers the period up to `untilMs`. Auto-profit will not overwrite the
  // plan while an override is in charge, so manual Force UP/DOWN always wins.
  _activeOverrideCovers(symbol, untilMs) {
    const list = this.overrides[symbol]
    if (!list || !list.length) return false
    const now = Date.now()
    return list.some((o) => o.bEndMs > now && o.bStartMs <= untilMs)
  }

  // Auto-profit engine: steer toward a target price by the next relevant trade
  // expiry. Re-plan only when the target/deadline materially changes, so the
  // graph glides instead of resetting every second.
  // IMPORTANT: if an admin override is active, we still update the auto target
  // metadata but we do NOT regenerate the plan — manual steering takes priority.
  setAutoTarget(symbol, target, opts = {}) {
    if (!this.assets[symbol] || !this.plan[symbol] || target == null) return
    const prev = this.autoTarget[symbol]
    const prevPlan = this.autoPlan[symbol]
    const a = this.assets[symbol]
    const now = Date.now()
    const deadlineMs = Math.max(now + 1000, Number(opts.deadlineMs) || now + 15000)
    this.autoTarget[symbol] = target
    this.autoPlan[symbol] = {
      target,
      deadlineMs,
      createdAt: prevPlan && Math.abs((prevPlan.deadlineMs || 0) - deadlineMs) <= 1000 ? prevPlan.createdAt : now,
      phase: prevPlan?.phase ?? Math.random() * Math.PI * 2,
      real: !!opts.real,
    }

    const targetMoved = prev == null || Math.abs(prev - target) >= a.volatility * 0.5
    const deadlineMoved = !prevPlan || Math.abs((prevPlan.deadlineMs || 0) - deadlineMs) > 1000
    if (!targetMoved && !deadlineMoved) return

    // Manual candle override is active -> auto-profit steps aside.
    if (this._activeOverrideCovers(symbol, deadlineMs)) {
      return
    }

    const cur = this._planPriceAt(symbol, now)
    const oldVelocity = this._planVelocityAt(symbol, now)
    this.plan[symbol] = {
      startT: Math.floor(now / PLAN_STEP_MS) * PLAN_STEP_MS,
      prices: [cur],
      head: this._makeHead(cur, oldVelocity * 0.35, cur),
    }
    this._extendPlan(symbol, now + PLAN_AHEAD_MS)
  }

  clearAutoTarget(symbol) {
    if (this.autoTarget[symbol] == null) return
    this.autoTarget[symbol] = null
    this.autoPlan[symbol] = null
    if (!this.assets[symbol] || !this.plan[symbol]) return
    // Don't wipe an active manual override when auto-profit disengages.
    if (this._activeOverrideCovers(symbol, Date.now() + PLAN_AHEAD_MS)) return
    const a = this.assets[symbol]
    const now = Date.now()
    const cur = this._planPriceAt(symbol, now)
    const velocity = this._planVelocityAt(symbol, now)
    this.plan[symbol] = {
      startT: Math.floor(now / PLAN_STEP_MS) * PLAN_STEP_MS,
      prices: [cur],
      head: this._makeHead(cur, velocity, a.anchor),
    }
    this._extendPlan(symbol, now + PLAN_AHEAD_MS)
  }

  // Future candles projected from the plan, for the admin preview.
  getFutureCandles(symbol, tf, count = 12) {
    if (!this.plan[symbol]) return []
    const tfSec = TIMEFRAMES[tf] || 60
    const plan = this.plan[symbol]
    const curBucket = bucketStart(nowSecFrom(Date.now()), tfSec)
    const buckets = new Map()
    for (let i = 0; i < plan.prices.length; i++) {
      const tSec = Math.floor((plan.startT + i * PLAN_STEP_MS) / 1000)
      const b = bucketStart(tSec, tfSec)
      if (b <= curBucket) continue // only fully-future buckets
      const p = this._round(symbol, plan.prices[i])
      let c = buckets.get(b)
      if (!c) c = buckets.set(b, { time: b, open: p, high: p, low: p, close: p, volume: 0, planned: true }).get(b)
      else {
        c.close = p
        if (p > c.high) c.high = p
        if (p < c.low) c.low = p
      }
    }
    return Array.from(buckets.values()).sort((x, y) => x.time - y.time).slice(0, count)
  }

  // Combined past + forming + future series for the admin candle-control view.
  getAdminSeries(symbol, tf) {
    if (!this.history[symbol] || !this.history[symbol][tf]) return null
    const now = Date.now()
    return {
      symbol,
      timeframe: tf,
      digits: this.meta[symbol].digits,
      candles: this.history[symbol][tf].slice(-60),
      forming: this.forming[symbol][tf],
      // live assets aren't steered, so there's no synthetic "future plan" to show
      future: this.isLive(symbol) ? [] : this.getFutureCandles(symbol, tf, 12),
      overrides: (this.overrides[symbol] || []).filter((o) => o.bEndMs > now),
      autoActive: this.autoTarget[symbol] != null,
      autoTarget: this.autoTarget[symbol] != null ? this._round(symbol, this.autoTarget[symbol]) : null,
      price: this.getPrice(symbol),
    }
  }

  // sidebar summary: price + % change over recent candles
  getSummary() {
    return Object.keys(this.assets).map((symbol) => {
      const hist = this.history[symbol]['1m'] || []
      const ref = hist.length > 30 ? hist[hist.length - 30].close : hist[0]?.close
      const price = this.getPrice(symbol)
      const changePct = ref ? ((price - ref) / ref) * 100 : 0
      return {
        ...this.meta[symbol],
        price,
        changePct: Number(changePct.toFixed(2)),
      }
    })
  }

  getMeta(symbol) {
    return this.meta[symbol] || null
  }
  allMeta() {
    return Object.values(this.meta)
  }
}

module.exports = new PriceEngine()
module.exports.PriceEngine = PriceEngine
module.exports.TIMEFRAMES = TIMEFRAMES
