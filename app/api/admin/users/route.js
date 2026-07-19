import { NextResponse } from 'next/server'
const connectDB = require('@/lib/db')
const User = require('@/lib/models/User')
const Trade = require('@/lib/models/Trade')
const { requireAdmin } = require('@/lib/requireAdmin')

const DEFAULT_LIMIT = 20

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export async function GET(request) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  await connectDB()

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || DEFAULT_LIMIT))
  const q = String(searchParams.get('q') || '').trim()

  // An admin never manages their own account from the user list.
  const query = { _id: { $ne: admin._id } }
  if (q) query.email = { $regex: escapeRegExp(q), $options: 'i' }

  const [total, users] = await Promise.all([
    User.countDocuments(query),
    User.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
  ])

  const userIds = users.map((u) => u._id)
  const counts = await Trade.aggregate([
    { $match: { userId: { $in: userIds } } },
    { $group: { _id: '$userId', n: { $sum: 1 } } },
  ])
  const countMap = Object.fromEntries(counts.map((c) => [c._id.toString(), c.n]))

  return NextResponse.json({
    users: users.map((u) => ({
      id: u._id.toString(),
      email: u.email,
      role: u.role,
      demoBalance: u.demoBalance,
      realBalance: u.realBalance,
      trades: countMap[u._id.toString()] || 0,
      isBanned: u.isBanned,
      createdAt: u.createdAt,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
}
