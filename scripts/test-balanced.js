// Focused test for Balanced mode:
// 1. Single user, small stake (< $40) -> should be random/natural.
// 2. Single user, larger stake (>= $40) -> single-user realism.
// 3. Multiple users, total >= $40 -> house profit squeeze.
// Duration is 15s so the auto-profit engine has time to steer.

require('dotenv').config({ path: '.env.local' })
require('dotenv').config()

const io = require('socket.io-client')

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:5001'
const API = 'http://localhost:3000'
const SYMBOL = 'EUR/USD'
const TF = '1m'
const DURATION = 15

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

function waitForTrades(socket, count, timeoutMs) {
  return new Promise((resolve) => {
    const results = []
    const handler = (data) => {
      if (data.symbol === SYMBOL) results.push(data)
      if (results.length >= count) {
        socket.off('trade_closed', handler)
        resolve(results)
      }
    }
    socket.on('trade_closed', handler)
    setTimeout(() => {
      socket.off('trade_closed', handler)
      resolve(results)
    }, timeoutMs)
  })
}

async function setupAdmin(adminSocket) {
  adminSocket.emit('admin:auto_asset', { symbol: SYMBOL, on: true })
  adminSocket.emit('admin:auto_mode', { mode: 'balanced' })
  await new Promise((r) => setTimeout(r, 500))
}

async function openTrade(userSocket, amount, direction) {
  return new Promise((resolve, reject) => {
    userSocket.emit(
      'open_trade',
      { symbol: SYMBOL, direction, amount, duration: DURATION, accountType: 'demo' },
      (res) => {
        if (res.error) return reject(new Error(res.error))
        resolve(res.trade)
      }
    )
    setTimeout(() => reject(new Error('open_trade timeout')), 5000)
  })
}

async function runBatch(label, trades) {
  console.log(`\n=== ${label} ===`)
  const adminCookie = await login(ADMIN)
  const userCookie = await login(USER)
  const adminSocket = await connect(await getSocketToken(adminCookie))
  const userSocket = await connect(await getSocketToken(userCookie))

  await setupAdmin(adminSocket)
  const total = trades.reduce((s, t) => s + t.amount, 0)
  console.log(`  total stake $${total}, ${trades.length} trades`)

  const resultsPromise = waitForTrades(userSocket, trades.length, 25000)
  for (const t of trades) {
    await openTrade(userSocket, t.amount, t.direction)
    await new Promise((r) => setTimeout(r, 150))
  }

  const results = await resultsPromise
  const wins = results.filter((r) => r.result === 'win').length
  const losses = results.length - wins
  console.log(`  RESULTS: ${wins}/${results.length} wins (${((wins / results.length) * 100).toFixed(0)}%)`)
  for (const r of results) {
    const expected = r.direction === 'up' ? (r.closePrice > r.openPrice ? 'WIN' : 'LOSS') : (r.closePrice < r.openPrice ? 'WIN' : 'LOSS')
    console.log(`    ${r.result.toUpperCase()} ${r.direction} $${r.amount} open=${r.openPrice.toFixed(5)} close=${r.closePrice.toFixed(5)} [price moved ${expected}]`)
  }

  adminSocket.disconnect()
  userSocket.disconnect()
  return { wins, losses, total: results.length }
}

async function main() {
  await new Promise((r) => setTimeout(r, 1000))

  // 1. Small money single user -> random/natural
  await runBatch('Balanced: single user $10 (under $40 threshold)', [
    { amount: 10, direction: 'up' },
  ])

  // 2. Run 5 single $10 trades one by one to see distribution
  console.log('\n--- 5 consecutive $10 single-user trades ---')
  for (let i = 1; i <= 5; i++) {
    await runBatch(`Balanced: single user $10 #${i}`, [{ amount: 10, direction: 'up' }])
  }

  // 3. Single user $50 (over threshold) -> single-user realism
  await runBatch('Balanced: single user $50 (over $40 threshold)', [
    { amount: 50, direction: 'up' },
  ])

  // 4. Multiple trades total $150 same direction -> house profit squeeze
  await runBatch('Balanced: 3 users/trades $50 each, all UP (total $150)', [
    { amount: 50, direction: 'up' },
    { amount: 50, direction: 'up' },
    { amount: 50, direction: 'up' },
  ])

  console.log('\nBalanced mode focused tests completed.')
  process.exit(0)
}

main().catch((e) => {
  console.error('Test failed:', e.message)
  process.exit(1)
})
