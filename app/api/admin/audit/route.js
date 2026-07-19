import { NextResponse } from 'next/server'
const connectDB = require('@/lib/db')
const AdminAudit = require('@/lib/models/AdminAudit')
const { requireAdmin } = require('@/lib/requireAdmin')

const DEFAULT_LIMIT = 20

// GET /api/admin/audit?page=1&limit=20&action=user.setBalance
// Returns the most recent admin actions (newest first).
export async function GET(request) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await connectDB()
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || DEFAULT_LIMIT))
  const action = searchParams.get('action')
  const query = action ? { action } : {}

  const [total, rows] = await Promise.all([
    AdminAudit.countDocuments(query),
    AdminAudit.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('adminId', 'email')
      .lean(),
  ])

  return NextResponse.json({
    entries: rows.map((r) => ({
      id: r._id.toString(),
      admin: r.adminEmail || r.adminId?.email || '—',
      action: r.action,
      target: r.target,
      summary: r.summary,
      createdAt: r.createdAt,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
}
