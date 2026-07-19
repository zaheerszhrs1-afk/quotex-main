import { NextResponse } from 'next/server'
const connectDB = require('@/lib/db')
const Trade = require('@/lib/models/Trade')
const { requireAdmin } = require('@/lib/requireAdmin')

// House P&L over rolling windows, REAL accounts only (demo isn't real money).
// houseNet = -sum(profit): a user's losing trade has profit = -stake (house +),
// a winning trade has profit = +winnings (house -). Win-rate = won / resolved.
async function windowStats(since) {
  const match = { status: { $in: ['won', 'lost'] }, accountType: 'real' }
  if (since) match.closeTime = { $gte: since }
  const agg = await Trade.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        wagered: { $sum: '$amount' },
        profit: { $sum: '$profit' },
        trades: { $sum: 1 },
        wins: { $sum: { $cond: [{ $eq: ['$status', 'won'] }, 1, 0] } },
      },
    },
  ])
  const r = agg[0] || { wagered: 0, profit: 0, trades: 0, wins: 0 }
  return {
    wagered: Math.round(r.wagered * 100) / 100,
    houseNet: Math.round(-r.profit * 100) / 100,
    trades: r.trades,
    userWinRate: r.trades ? Math.round((r.wins / r.trades) * 1000) / 10 : 0, // %
  }
}

export async function GET(request) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await connectDB()
  const now = Date.now()
  const startOfToday = new Date(new Date().setHours(0, 0, 0, 0))
  const [today, week, month, all] = await Promise.all([
    windowStats(startOfToday),
    windowStats(new Date(now - 7 * 864e5)),
    windowStats(new Date(now - 30 * 864e5)),
    windowStats(null),
  ])
  return NextResponse.json({ today, week, month, all })
}
