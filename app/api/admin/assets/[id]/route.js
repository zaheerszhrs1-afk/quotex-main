import { NextResponse } from 'next/server'
const connectDB = require('@/lib/db')
const Asset = require('@/lib/models/Asset')
const { requireAdmin } = require('@/lib/requireAdmin')

// PATCH /api/admin/assets/:id  { payout?, isActive? }
// Note: the price engine reads assets at server startup; restart the WS server
// (or it picks up on next boot) for asset toggles to affect live streaming.
export async function PATCH(request, { params }) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await connectDB()
  const body = await request.json()
  const update = {}
  if (body.payout != null) {
    const p = Number(body.payout)
    if (p < 1 || p > 100) return NextResponse.json({ error: 'Payout must be 1–100.' }, { status: 400 })
    update.payout = p
  }
  if (body.isActive != null) update.isActive = Boolean(body.isActive)

  const asset = await Asset.findByIdAndUpdate(params.id, update, { new: true })
  if (!asset) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({
    asset: {
      id: asset._id.toString(),
      symbol: asset.symbol,
      payout: asset.payout,
      isActive: asset.isActive,
    },
  })
}
