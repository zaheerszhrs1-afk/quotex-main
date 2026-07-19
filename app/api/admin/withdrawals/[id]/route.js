import { NextResponse } from 'next/server'
const connectDB = require('@/lib/db')
const WithdrawRequest = require('@/lib/models/WithdrawRequest')
const User = require('@/lib/models/User')
const { requireAdmin } = require('@/lib/requireAdmin')
const { logAdmin } = require('@/lib/auditLog')

// PATCH /api/admin/withdrawals/:id  { action: 'approve'|'reject', note }
// Funds were reserved at request time. Reject refunds them.
export async function PATCH(request, { params }) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await connectDB()
  const { action, note } = await request.json()
  const w = await WithdrawRequest.findById(params.id)
  if (!w) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (w.status !== 'pending') {
    return NextResponse.json({ error: 'Already processed.' }, { status: 400 })
  }

  if (action === 'approve') {
    w.status = 'approved'
  } else if (action === 'reject') {
    await User.findByIdAndUpdate(w.userId, { $inc: { realBalance: w.amount } })
    w.status = 'rejected'
    w.adminNote = note || ''
  } else {
    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 })
  }
  await w.save()
  await logAdmin({
    adminId: admin._id,
    adminEmail: admin.email,
    action: `withdrawal.${action}`,
    target: String(w.userId),
    summary: `${action === 'approve' ? 'Approved' : 'Rejected (refunded)'} withdrawal of $${w.amount} (${w.method})`,
    meta: { amount: w.amount, method: w.method, note: note || '' },
  })
  return NextResponse.json({ ok: true, status: w.status })
}
