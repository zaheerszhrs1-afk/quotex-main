import { NextResponse } from 'next/server'
const connectDB = require('@/lib/db')
const WithdrawRequest = require('@/lib/models/WithdrawRequest')
const User = require('@/lib/models/User')
const { getSettings } = require('@/lib/getSettings')
const { getUserFromRequest } = require('@/lib/serverAuth')

export async function GET(request) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  await connectDB()
  const list = await WithdrawRequest.find({ userId: user._id }).sort({ createdAt: -1 }).lean()
  return NextResponse.json({ withdrawals: list.map(serialize) })
}

export async function POST(request) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  await connectDB()
  const body = await request.json()
  const amount = Number(body.amount)
  const method = String(body.method || 'JazzCash')
  const settings = await getSettings()

  if (!Number.isFinite(amount) || amount < settings.minWithdrawal) {
    return NextResponse.json(
      { error: `Minimum withdrawal is ${settings.minWithdrawal}.` },
      { status: 400 }
    )
  }

  // reserve the funds from the REAL balance (refunded by admin on reject)
  const updated = await User.findOneAndUpdate(
    { _id: user._id, realBalance: { $gte: amount } },
    { $inc: { realBalance: -amount } },
    { new: true }
  )
  if (!updated) {
    return NextResponse.json({ error: 'Insufficient real balance.' }, { status: 400 })
  }

  const w = await WithdrawRequest.create({
    userId: user._id,
    method,
    amount,
    recipientDetails: String(body.recipientDetails || ''),
    status: 'pending',
  })
  return NextResponse.json({
    withdrawal: serialize(w.toObject()),
    realBalance: updated.realBalance,
  })
}

function serialize(w) {
  return {
    id: w._id.toString(),
    method: w.method,
    amount: w.amount,
    recipientDetails: w.recipientDetails,
    status: w.status,
    adminNote: w.adminNote,
    createdAt: w.createdAt,
  }
}
