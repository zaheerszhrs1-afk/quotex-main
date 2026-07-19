import { NextResponse } from 'next/server'
const connectDB = require('@/lib/db')
const User = require('@/lib/models/User')
const Trade = require('@/lib/models/Trade')
const DepositRequest = require('@/lib/models/DepositRequest')
const WithdrawRequest = require('@/lib/models/WithdrawRequest')
const { requireAdmin } = require('@/lib/requireAdmin')

export async function GET(request) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await connectDB()
  const [totalUsers, activeTrades, depAgg, wdAgg, profitAgg, recentDeposits, recentWithdrawals] =
    await Promise.all([
      User.countDocuments(),
      Trade.countDocuments({ status: 'open' }),
      DepositRequest.aggregate([
        { $match: { status: 'approved' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      WithdrawRequest.aggregate([
        { $match: { status: 'approved' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      // platform profit on REAL accounts = -sum(profit) of closed real trades
      Trade.aggregate([
        { $match: { status: { $in: ['won', 'lost'] }, accountType: 'real' } },
        { $group: { _id: null, total: { $sum: '$profit' } } },
      ]),
      DepositRequest.find().sort({ createdAt: -1 }).limit(6).populate('userId', 'email').lean(),
      WithdrawRequest.find().sort({ createdAt: -1 }).limit(6).populate('userId', 'email').lean(),
    ])

  return NextResponse.json({
    totalUsers,
    activeTrades,
    totalDeposits: depAgg[0]?.total || 0,
    totalWithdrawals: wdAgg[0]?.total || 0,
    platformProfit: -(profitAgg[0]?.total || 0),
    recentDeposits: recentDeposits.map((d) => ({
      id: d._id.toString(),
      email: d.userId?.email || '—',
      method: d.method,
      amount: d.amount,
      status: d.status,
      createdAt: d.createdAt,
    })),
    recentWithdrawals: recentWithdrawals.map((w) => ({
      id: w._id.toString(),
      email: w.userId?.email || '—',
      method: w.method,
      amount: w.amount,
      status: w.status,
      createdAt: w.createdAt,
    })),
  })
}
