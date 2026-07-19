import { NextResponse } from 'next/server'
const connectDB = require('@/lib/db')
const { getSettings, DEFAULT_METHODS } = require('@/lib/getSettings')
const { requireAdmin } = require('@/lib/requireAdmin')

export async function GET(request) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  await connectDB()
  const s = await getSettings()
  return NextResponse.json({
    methods: s.methods,
    minDeposit: s.minDeposit,
    minWithdrawal: s.minWithdrawal,
    announcement: s.announcement,
  })
}

export async function PUT(request) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  await connectDB()
  const body = await request.json()
  const s = await getSettings()

  if (body.action === 'resetMethods') {
    s.methods = DEFAULT_METHODS
  } else if (Array.isArray(body.methods)) {
    s.methods = body.methods
      .filter((m) => m && m.name)
      .map((m) => ({
        name: String(m.name),
        type: ['mobile', 'bank', 'crypto'].includes(m.type) ? m.type : 'mobile',
        isEnabled: Boolean(m.isEnabled),
        popular: Boolean(m.popular),
        minAmount: Math.max(0, Number(m.minAmount) || 0),
        logo: m.logo || '',
        number: m.number || '',
        accountTitle: m.accountTitle || '',
        accountNumber: m.accountNumber || '',
        walletAddress: m.walletAddress || '',
      }))
  }
  if (body.minDeposit != null) s.minDeposit = Math.max(0, Number(body.minDeposit))
  if (body.minWithdrawal != null) s.minWithdrawal = Math.max(0, Number(body.minWithdrawal))
  if (body.announcement != null) s.announcement = String(body.announcement)

  await s.save()
  return NextResponse.json({ ok: true })
}
