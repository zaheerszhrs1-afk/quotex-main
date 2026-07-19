import { NextResponse } from 'next/server'
const connectDB = require('@/lib/db')
const DepositRequest = require('@/lib/models/DepositRequest')
const { getSettings } = require('@/lib/getSettings')
const { getUserFromRequest } = require('@/lib/serverAuth')
const { bonusFor } = require('@/lib/depositBonus')

export async function GET(request) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  await connectDB()
  const deposits = await DepositRequest.find({ userId: user._id }).sort({ createdAt: -1 }).lean()
  return NextResponse.json({ deposits: deposits.map(serialize) })
}

export async function POST(request) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  await connectDB()
  const body = await request.json()
  const amount = Number(body.amount)
  const method = String(body.method || '')
  const settings = await getSettings()

  if (!Number.isFinite(amount) || amount < settings.minDeposit) {
    return NextResponse.json(
      { error: `Minimum deposit is ${settings.minDeposit}.` },
      { status: 400 }
    )
  }
  if (!settings.methods.some((m) => m.name === method && m.isEnabled)) {
    return NextResponse.json({ error: 'Invalid or disabled payment method.' }, { status: 400 })
  }

  // compute the bonus server-side from the amount — never trust a client value
  const bonusCode = String(body.bonusCode || '')
  const { pct: bonusPct, bonus, code: appliedBonusCode } = bonusFor(amount, bonusCode)

  const dep = await DepositRequest.create({
    userId: user._id,
    method,
    amount,
    bonus,
    bonusPct,
    bonusCode: appliedBonusCode,
    senderNumber: String(body.senderNumber || ''),
    screenshotPath: String(body.screenshotPath || ''),
    status: 'pending',
  })
  return NextResponse.json({ deposit: serialize(dep.toObject()) })
}

function serialize(d) {
  return {
    id: d._id.toString(),
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
  }
}
