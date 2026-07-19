// Quick integration test for the new smart/balanced/strict auto-profit modes.
// Logs in as admin, connects via socket.io, cycles through modes, and verifies
// the admin:plan payload reflects each mode.

require('dotenv').config({ path: '.env.local' })
require('dotenv').config()

const io = require('socket.io-client')

const BASE = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:5001'
const LOGIN_URL = 'http://localhost:3000/api/auth/login'
const TOKEN_URL = 'http://localhost:3000/api/socket-token'

const ADMIN = { email: 'admin@test.com', password: 'Admin123!' }
const SYMBOL = 'BTC/USD'
const TF = '1m'

async function login() {
  const res = await fetch(LOGIN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(ADMIN),
  })
  if (!res.ok) throw new Error(`login failed: ${res.status}`)
  return res.headers.get('set-cookie')
}

async function getSocketToken(cookie) {
  const res = await fetch(TOKEN_URL, {
    headers: { cookie },
    cache: 'no-store',
  })
  const { token } = await res.json()
  if (!token) throw new Error('no socket token')
  return token
}

function connect(token) {
  return new Promise((resolve, reject) => {
    const socket = io(BASE, {
      transports: ['websocket', 'polling'],
      auth: { token },
    })
    socket.on('connect', () => resolve(socket))
    socket.on('connect_error', (e) => reject(e))
    setTimeout(() => reject(new Error('socket connect timeout')), 10000)
  })
}

function waitForPlan(socket) {
  return new Promise((resolve, reject) => {
    const onPlan = (plan) => {
      socket.off('admin:plan', onPlan)
      resolve(plan)
    }
    socket.on('admin:plan', onPlan)
    setTimeout(() => reject(new Error('admin:plan timeout')), 5000)
  })
}

async function setModeAndVerify(socket, mode) {
  socket.emit('admin:auto_mode', { mode })
  // give the server a moment to persist + broadcast
  await new Promise((r) => setTimeout(r, 300))
  socket.emit('admin:watch_plan', { symbol: SYMBOL, timeframe: TF })
  const plan = await waitForPlan(socket)
  if (plan.mode !== mode) {
    throw new Error(`expected mode=${mode}, got mode=${plan.mode}`)
  }
  console.log(`✓ mode switched to ${mode}`)
}

async function main() {
  const cookie = await login()
  const token = await getSocketToken(cookie)
  const socket = await connect(token)
  console.log('socket connected:', socket.id)

  // enable auto-profit for this asset so mode matters
  socket.emit('admin:auto_asset', { symbol: SYMBOL, on: true })
  await new Promise((r) => setTimeout(r, 300))

  await setModeAndVerify(socket, 'smart')
  await setModeAndVerify(socket, 'balanced')
  await setModeAndVerify(socket, 'strict')
  await setModeAndVerify(socket, 'balanced')

  socket.disconnect()
  console.log('\nAll mode tests passed.')
  process.exit(0)
}

main().catch((e) => {
  console.error('Test failed:', e.message)
  process.exit(1)
})
