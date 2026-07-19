import { NextResponse } from 'next/server'
const connectDB = require('@/lib/db')
const WithdrawRequest = require('@/lib/models/WithdrawRequest')
const { requireAdmin } = require('@/lib/requireAdmin')

const DEFAULT_LIMIT = 20

export async function GET(request) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  await connectDB()

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || DEFAULT_LIMIT))
  const status = searchParams.get('status')
  const q = status && status !== 'all' ? { status } : {}

  const [total, list] = await Promise.all([
    WithdrawRequest.countDocuments(q),
    WithdrawRequest.find(q).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('userId', 'email').lean(),
  ])

  return NextResponse.json({
    withdrawals: list.map((w) => ({
      id: w._id.toString(),
      email: w.userId?.email || '—',
      method: w.method,
      amount: w.amount,
      recipientDetails: w.recipientDetails,
      status: w.status,
      adminNote: w.adminNote,
      createdAt: w.createdAt,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
}
