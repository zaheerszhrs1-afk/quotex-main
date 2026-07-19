import { NextResponse } from 'next/server'
const connectDB = require('@/lib/db')
const { getSettings } = require('@/lib/getSettings')

export const dynamic = 'force-dynamic'

// Public-ish: enabled payment methods + limits + announcement (shown in app).
export async function GET() {
  try {
    await connectDB()
    const s = await getSettings()
    return NextResponse.json({
      methods: s.methods
        .filter((m) => m.isEnabled)
        .map((m) => ({
          name: m.name,
          type: m.type,
          popular: m.popular,
          minAmount: m.minAmount,
          logo: m.logo,
          number: m.number,
          accountTitle: m.accountTitle,
          accountNumber: m.accountNumber,
          walletAddress: m.walletAddress,
        })),
      minDeposit: s.minDeposit,
      minWithdrawal: s.minWithdrawal,
      announcement: s.announcement,
    })
  } catch {
    return NextResponse.json({ methods: [], minDeposit: 100, minWithdrawal: 200, announcement: '' })
  }
}
