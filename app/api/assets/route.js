import { NextResponse } from 'next/server'
const connectDB = require('@/lib/db')
const Asset = require('@/lib/models/Asset')
const { ASSETS } = require('@/lib/assetsConfig')

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await connectDB()
    let assets = await Asset.find({ isActive: true }).lean()
    if (!assets.length) {
      // fall back to static config if not seeded yet
      assets = ASSETS.map((a) => ({
        symbol: a.symbol,
        name: a.name,
        category: a.category,
        payout: a.payout,
        isActive: true,
      }))
    } else {
      // include config assets not yet in the DB (e.g. newly added stocks) so
      // they show up without requiring a re-seed
      const have = new Set(assets.map((a) => a.symbol))
      for (const a of ASSETS) {
        if (!have.has(a.symbol)) {
          assets.push({ symbol: a.symbol, name: a.name, category: a.category, payout: a.payout, isActive: true })
        }
      }
    }
    return NextResponse.json({
      assets: assets.map((a) => ({
        symbol: a.symbol,
        name: a.name,
        category: a.category,
        payout: a.payout,
      })),
    })
  } catch (e) {
    return NextResponse.json(
      { assets: ASSETS.map((a) => ({ symbol: a.symbol, name: a.name, category: a.category, payout: a.payout })) },
      { status: 200 }
    )
  }
}
