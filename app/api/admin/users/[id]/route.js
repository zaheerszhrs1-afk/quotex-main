import { NextResponse } from 'next/server'
const connectDB = require('@/lib/db')
const User = require('@/lib/models/User')
const { requireAdmin } = require('@/lib/requireAdmin')
const { logAdmin } = require('@/lib/auditLog')

// PATCH /api/admin/users/:id
//   { action: 'ban' }                       -> toggle ban
//   { action: 'setBalance', field, value }  -> set demoBalance|realBalance
//   { action: 'setRole', role }             -> promote/demote to admin|user
export async function PATCH(request, { params }) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await connectDB()
  const body = await request.json()
  // Guard: an admin can't act on their own account through this endpoint.
  if (String(params.id) === admin._id.toString()) {
    return NextResponse.json({ error: 'You cannot modify your own account here.' }, { status: 400 })
  }
  const user = await User.findById(params.id)
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let audit = null
  if (body.action === 'ban') {
    user.isBanned = !user.isBanned
    audit = {
      action: 'user.ban',
      summary: `${user.isBanned ? 'Banned' : 'Unbanned'} ${user.email}`,
      meta: { isBanned: user.isBanned },
    }
  } else if (body.action === 'setRole') {
    const before = user.role
    user.role = body.role === 'admin' ? 'admin' : 'user'
    audit = {
      action: 'user.setRole',
      summary: `Changed ${user.email} role: ${before} → ${user.role}`,
      meta: { before, after: user.role },
    }
  } else if (body.action === 'setBalance') {
    const field = body.field === 'realBalance' ? 'realBalance' : 'demoBalance'
    const value = Number(body.value)
    if (!Number.isFinite(value) || value < 0) {
      return NextResponse.json({ error: 'Invalid value.' }, { status: 400 })
    }
    const before = user[field]
    user[field] = value
    audit = {
      action: 'user.setBalance',
      summary: `Set ${user.email} ${field}: ${before} → ${value}`,
      meta: { field, before, after: value },
    }
  } else {
    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 })
  }
  await user.save()
  await logAdmin({
    adminId: admin._id,
    adminEmail: admin.email,
    target: user.email,
    ...audit,
  })
  return NextResponse.json({ user: user.toSafeJSON() })
}
