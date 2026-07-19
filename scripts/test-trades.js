// End-to-end test for auto-profit modes with real trade resolution.
// Admin enables auto-profit + sets mode; user opens short trades; we wait for
// expiry and print win/loss distribution.
//
// Run after: npm run memdb + node server/index.js + next dev

require('dotenv').config({ path: '.env.local' })
require('dotenv').config()

const io = require('socket.io-client')

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:5001'
const API = 'http://localhost:3000'
const TF = '1m'
const DURATION = 5 // seconds
const AMOUNT = 10

const SCENARIOS = [
  { symbol: 'EUR/USD', label: 'Smart single' },
  { symbol: 'GBP/USD', label: 'Smart multi' },
  { symbol: 'USD/JPY', label: 'Balanced single' },
  { symbol: 'AUD/USD', label: 'Balanced multi' },
  { symbol: 'Gold', label: 'Strict multi' },
  { symbol: 'Oil', label: 'Balanced multi + Force UP' },
]

const ADMIN = { email: 'admin@test.com', password: 'Admin123!' }
const USER = { email: 'user@test.com', password: 'User123!' }

async function login(creds) {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(creds),
  })
  if (!res.ok) throw new Error(`login failed: ${res.status}`)
  return res.headers.get('set-cookie')
}

async function getSocketToken(cookie) {
  const res = await fetch(`${API}/api/socket-token`, {
    headers: { cookie },
    cache: 'no-store',
  })
  const { token } = await res.json()
  if (!token) throw new Error('no socket token')
  return token
}

function connect(token) {
  return new Promise((resolve, reject) => {
    const socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      auth: { token },
    })
    socket.on('connect', () => resolve(socket))
    socket.on('connect_error', (e) => reject(e))
    setTimeout(() => reject(new Error('socket connect timeout')), 10000)
  })
}

function waitForTradeClosed(socket, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const results = []
    const handler = (data) => {
      results.push(data)
    }
    socket.on('trade_closed', handler)
    setTimeout(() => {
      socket.off('trade_closed', handler)
      resolve(results)
    }, timeoutMs)
  })
}

async function setupAdmin(adminSocket, symbol, mode) {
  return new Promise((resolve, reject) => {
    adminSocket.emit('admin:auto_asset', { symbol, on: true })
    adminSocket.emit('admin:auto_mode', { mode })
    setTimeout(() => {
      adminSocket.emit('admin:watch_plan', { symbol, timeframe: TF })
      const onPlan = (plan) => {
        if (plan.symbol === symbol && plan.timeframe === TF) {
          adminSocket.off('admin:plan', onPlan)
          resolve(plan)
        }
      }
      adminSocket.on('admin:plan', onPlan)
      setTimeout(() => reject(new Error('admin plan timeout')), 5000)
    }, 500)
  })
}

async function openTrade(userSocket, symbol, direction) {
  return new Promise((resolve, reject) => {
    userSocket.emit(
      'open_trade',
      { symbol, direction, amount: AMOUNT, duration: DURATION, accountType: 'demo' },
      (res) => {
        if (res.error) return reject(new Error(res.error))
        resolve(res.trade)
      }
    )
    setTimeout(() => reject(new Error('open_trade timeout')), 5000)
  })
}

async function forceCandle(adminSocket, symbol, direction) {
  return new Promise((resolve, reject) => {
    adminSocket.emit(
      'admin:set_candle',
      { symbol, timeframe: TF, direction, strength: 5, which: 'current' },
      (res) => {
        if (res.error) return reject(new Error(res.error))
        resolve(res.override)
      }
    )
    setTimeout(() => reject(new Error('set_candle timeout')), 5000)
  })
}

async function runScenario(label, mode, tradeCount, forceDirection = null) {
  const { symbol } = SCENARIOS.find((s) => s.label === label)
  console.log(`\n=== ${label} | mode=${mode} symbol=${symbol} trades=${tradeCount} force=${forceDirection || 'none'} ===`)

  const adminCookie = await login(ADMIN)
  const userCookie = await login(USER)
  const adminToken = await getSocketToken(adminCookie)
  const userToken = await getSocketToken(userCookie)
  const adminSocket = await connect(adminToken)
  const userSocket = await connect(userToken)

  const plan = await setupAdmin(adminSocket, symbol, mode)
  console.log(`  admin plan ready, auto=${plan.auto}, mode=${plan.mode}`)

  // Wait long enough for all trades to close; extra buffer avoids missing events.
  const resultsPromise = waitForTradeClosed(userSocket, 15000)

  // Open trades staggered within 1 second so they share roughly the same expiry window.
  // For the Force UP test, open all UP so the forced UP should make them win.
  const directions = forceDirection ? Array(tradeCount).fill(forceDirection) : ['up', 'down', 'up']
  const opened = []
  for (let i = 0; i < tradeCount; i++) {
    opened.push(await openTrade(userSocket, symbol, directions[i % directions.length]))
    await new Promise((r) => setTimeout(r, 100))
  }
  console.log(`  opened ${opened.length} trades`)

  // After opening, optionally force the current candle in a specific direction.
  // The auto engine should step aside and this forced direction should dominate.
  if (forceDirection) {
    await new Promise((r) => setTimeout(r, 500))
    const ov = await forceCandle(adminSocket, symbol, forceDirection)
    console.log(`  forced candle ${forceDirection} -> target close ${ov.close}`)
  }

  const results = await resultsPromise
  // Only count trades for this symbol.
  const filtered = results.filter((r) => r.symbol === symbol)
  const wins = filtered.filter((r) => r.result === 'win').length
  const losses = filtered.length - wins
  console.log(`  RESULTS: ${wins} wins, ${losses} losses out of ${filtered.length} closed trades`)
  for (const r of filtered) {
    console.log(`    ${r.result.toUpperCase()} ${r.direction} open=${r.openPrice.toFixed(5)} close=${r.closePrice.toFixed(5)}`)
  }

  adminSocket.disconnect()
  userSocket.disconnect()
  return { wins, losses, total: filtered.length }
}

async function main() {
  // Small delay so any previous state settles.
  await new Promise((r) => setTimeout(r, 1000))

  for (const s of SCENARIOS) {
    if (s.label.includes('Force UP')) {
      await runScenario(s.label, 'balanced', 3, 'up')
    } else if (s.label.includes('single')) {
      await runScenario(s.label, s.label.split(' ')[0].toLowerCase(), 1)
    } else {
      await runScenario(s.label, s.label.split(' ')[0].toLowerCase(), 3)
    }
    // Gap between scenarios so sockets clean up and trades fully expire.
    await new Promise((r) => setTimeout(r, 3000))
  }

  console.log('\nAll trade scenarios completed.')
  process.exit(0)
}

main().catch((e) => {
  console.error('Trade test failed:', e.message)
  process.exit(1)
})
