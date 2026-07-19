import { NextResponse } from 'next/server'
const connectDB = require('@/lib/db')
const Trade = require('@/lib/models/Trade')
const { getUserFromRequest } = require('@/lib/serverAuth')

// GET /api/trades?status=open|closed  -> current user's trades
export async function GET(request) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  await connectDB()
  const status = request.nextUrl.searchParams.get('status')
  const query = { userId: user._id }
  if (status === 'open') query.status = 'open'
  else if (status === 'closed') query.status = { $in: ['won', 'lost'] }

  const trades = await Trade.find(query).sort({ createdAt: -1 }).limit(100).lean()
  return NextResponse.json({
    trades: trades.map((t) => ({
      id: t._id.toString(),
      symbol: t.symbol,
      direction: t.direction,
      amount: t.amount,
      duration: t.duration,
      payout: t.payout,
      openPrice: t.openPrice,
      closePrice: t.closePrice,
      openTime: t.openTime,
      closeTime: t.closeTime,
      status: t.status,
      profit: t.profit,
      accountType: t.accountType,
    })),
  })
}
