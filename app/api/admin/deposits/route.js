import { NextResponse } from 'next/server'
const connectDB = require('@/lib/db')
const DepositRequest = require('@/lib/models/DepositRequest')
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
    DepositRequest.countDocuments(q),
    DepositRequest.find(q).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('userId', 'email').lean(),
  ])

  return NextResponse.json({
    deposits: list.map((d) => ({
      id: d._id.toString(),
      email: d.userId?.email || '—',
      method: d.method,
      amount: d.amount,
      bonus: d.bonus || 0,
      bonusPct: d.bonusPct || 0,
      bonusCode: d.bonusCode || '',
      senderNumber: d.senderNumber,
      screenshotPath: d.screenshotPath,
      status: d.status,
      adminNote: d.adminNote,
      createdAt: d.createdAt,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
}
