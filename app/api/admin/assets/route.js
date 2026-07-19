import { NextResponse } from 'next/server'
const connectDB = require('@/lib/db')
const Asset = require('@/lib/models/Asset')
const { requireAdmin } = require('@/lib/requireAdmin')

const DEFAULT_LIMIT = 20

export async function GET(request) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  await connectDB()

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || DEFAULT_LIMIT))

  const [total, assets] = await Promise.all([
    Asset.countDocuments(),
    Asset.find().sort({ category: 1, symbol: 1 }).skip((page - 1) * limit).limit(limit).lean(),
  ])

  return NextResponse.json({
    assets: assets.map((a) => ({
      id: a._id.toString(),
      symbol: a.symbol,
      name: a.name,
      category: a.category,
      payout: a.payout,
      isActive: a.isActive,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
}
