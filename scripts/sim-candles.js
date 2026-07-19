// Offline simulator for the price engine. Advances mocked time and reports,
// per timeframe, candle-shape stats + total price drift — so we can tune candle
// realism (and prove price stays bounded / no crash) without the live UI.
const path = require('path')
const { PriceEngine } = require(path.join(__dirname, '..', 'server', 'priceEngine.js'))

const SYMBOL = process.argv[2] || 'EURUSD'
const MINUTES = Number(process.argv[3] || 30)

// mock Date.now so each tick advances 250ms (the real tick cadence)
let nowMs = 1_700_000_000_000
const realNow = Date.now
Date.now = () => nowMs

const params = process.env.PARAMS ? JSON.parse(process.env.PARAMS) : undefined
const eng = new PriceEngine(params)
if (params) console.log('params:', JSON.stringify(params))
eng.init()
const sym = eng.getMeta(SYMBOL) ? SYMBOL : eng.allMeta()[0].symbol
const base = eng.getPrice(sym)

// snapshot seeded backfill (what the user sees on first load) before any ticks
const seedSnapshot = {}
for (const tf of ['5s', '10s', '15s', '30s', '1m', '5m']) {
  const s = eng.getSeries(sym, tf)
  if (s) seedSnapshot[tf] = s.candles.slice(-60)
}

const ticks = MINUTES * 60 * 4 // 4 ticks/sec
let min = Infinity, max = -Infinity
for (let i = 0; i < ticks; i++) {
  nowMs += 250
  eng.tick()
  const p = eng.getPrice(sym)
  if (p < min) min = p
  if (p > max) max = p
}
Date.now = realNow

function statsOf(cs) {
  let rangeSum = 0, bodySum = 0, n = 0
  for (const c of cs) {
    const range = c.high - c.low
    if (range <= 0) continue
    rangeSum += range / c.close
    bodySum += Math.abs(c.close - c.open) / range
    n++
  }
  if (!n) return null
  return {
    avgRangePct: ((rangeSum / n) * 100).toFixed(3) + '%',
    bodyRatio: (bodySum / n).toFixed(2),
  }
}

console.log(`\n=== ${sym}  base=${base}  after ${MINUTES} min ===`)
console.log(`price range: ${min} .. ${max}  (drift ${(((max - min) / base) * 100).toFixed(2)}% of base)`)
console.log(`final price: ${eng.getPrice(sym)}  (${(((eng.getPrice(sym) - base) / base) * 100).toFixed(2)}% vs start)`)
console.log('\ntf    SEED (first load)      LIVE (after run)')
for (const tf of ['5s', '10s', '15s', '30s', '1m', '5m']) {
  const s = eng.getSeries(sym, tf)
  if (!s) continue
  const seed = statsOf(seedSnapshot[tf] || [])
  const live = statsOf(s.candles.slice(-60))
  const fmt = (x) => (x ? `range≈${x.avgRangePct.padStart(7)} body=${x.bodyRatio}` : 'n/a')
  console.log(`  ${tf.padEnd(4)} ${fmt(seed).padEnd(24)} ${fmt(live)}`)
}
