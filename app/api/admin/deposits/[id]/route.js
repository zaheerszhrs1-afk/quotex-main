import { NextResponse } from 'next/server'
const connectDB = require('@/lib/db')
const DepositRequest = require('@/lib/models/DepositRequest')
const User = require('@/lib/models/User')
const { requireAdmin } = require('@/lib/requireAdmin')
const { logAdmin } = require('@/lib/auditLog')

// PATCH /api/admin/deposits/:id  { action: 'approve'|'reject', note }
export async function PATCH(request, { params }) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await connectDB()
  const { action, note } = await request.json()
  const dep = await DepositRequest.findById(params.id)
  if (!dep) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (dep.status !== 'pending') {
    return NextResponse.json({ error: 'Already processed.' }, { status: 400 })
  }

  if (action === 'approve') {
    // credit the deposit plus any qualifying bonus
    const credit = dep.amount + (dep.bonus || 0)
    await User.findByIdAndUpdate(dep.userId, { $inc: { realBalance: credit } })
    dep.status = 'approved'
  } else if (action === 'reject') {
    dep.status = 'rejected'
    dep.adminNote = note || ''
  } else {
    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 })
  }
  await dep.save()
  await logAdmin({
    adminId: admin._id,
    adminEmail: admin.email,
    action: `deposit.${action}`,
    target: String(dep.userId),
    summary: `${action === 'approve' ? 'Approved' : 'Rejected'} deposit of $${dep.amount}${
      dep.bonus ? ` +$${dep.bonus} bonus` : ''
    } (${dep.method})`,
    meta: { amount: dep.amount, bonus: dep.bonus || 0, bonusCode: dep.bonusCode || '', method: dep.method, note: note || '' },
  })
  return NextResponse.json({ ok: true, status: dep.status })
}
