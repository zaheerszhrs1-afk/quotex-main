import { NextResponse } from 'next/server'
const connectDB = require('@/lib/db')
const Asset = require('@/lib/models/Asset')
const { ASSETS } = require('@/lib/assetsConfig')

export const dynamic = 'force-dynamic'

// Trading signals like the real Quotex "Trading signals" panel. Signals are
// deterministic per 5-minute bucket (same list for every client until the
// bucket rolls over, then a fresh set is generated).
const DURATIONS = ['05:00', '10:00', '15:00', '30:00', '01:00:00', '04:00:00']

function pseudo(n) {
  const x = Math.sin(n) * 10000
  return x - Math.floor(x)
}

export async function GET() {
  let assets = []
  try {
    await connectDB()
    assets = await Asset.find({ isActive: true }).lean()
  } catch {
    /* fall back to static config */
  }
  if (!assets.length) assets = ASSETS

  const bucket = Math.floor(Date.now() / (5 * 60 * 1000)) // rolls every 5 min
  const start = new Date(bucket * 5 * 60 * 1000)
  const pad = (n) => String(n).padStart(2, '0')
  const stamp = `${pad(start.getUTCDate())}.${pad(start.getUTCMonth() + 1)} ${pad(start.getUTCHours())}:${pad(start.getUTCMinutes())}`

  const count = Math.min(12, assets.length)
  const used = new Set()
  const signals = []
  for (let i = 0; signals.length < count && i < count * 4; i++) {
    const idx = Math.floor(pseudo(bucket * 7.31 + i * 3.17) * assets.length)
    if (used.has(idx)) continue
    used.add(idx)
    const a = assets[idx]
    signals.push({
      symbol: a.symbol,
      name: a.name,
      direction: pseudo(bucket * 1.93 + i * 5.07) > 0.5 ? 'up' : 'down',
      duration: DURATIONS[Math.floor(pseudo(bucket * 4.11 + i * 2.71) * DURATIONS.length)],
      time: stamp,
    })
  }

  return NextResponse.json({ signals })
}
