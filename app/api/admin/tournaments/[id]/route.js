import { NextResponse } from 'next/server'
const connectDB = require('@/lib/db')
const Tournament = require('@/lib/models/Tournament')
const TournamentEntry = require('@/lib/models/TournamentEntry')
const { requireAdmin } = require('@/lib/requireAdmin')
const { serializeTournament } = require('@/lib/tournamentHelpers')

const FIELDS = ['name', 'description', 'prizePool', 'entryFee', 'rebuyCost', 'rebuys', 'startBalance', 'isActive']

// PATCH /api/admin/tournaments/:id — edit a tournament
export async function PATCH(request, { params }) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  await connectDB()
  const body = await request.json()
  const update = {}
  for (const k of FIELDS) {
    if (body[k] == null) continue
    if (k === 'name' || k === 'description') update[k] = String(body[k])
    else if (k === 'isActive') update[k] = Boolean(body[k])
    else update[k] = Number(body[k]) || 0
  }
  if (body.startTime != null) {
    const d = new Date(body.startTime)
    if (!isNaN(d)) update.startTime = d
  }
  if (body.endTime != null) {
    const d = new Date(body.endTime)
    if (!isNaN(d)) update.endTime = d
  }
  if (Array.isArray(body.prizes)) update.prizes = body.prizes.map(Number).filter((n) => !isNaN(n))

  let t
  try {
    t = await Tournament.findByIdAndUpdate(params.id, update, { new: true })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (!t) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const participants = await TournamentEntry.countDocuments({ tournamentId: t._id })
  return NextResponse.json({ tournament: serializeTournament(t.toObject(), { participants }) })
}

// DELETE /api/admin/tournaments/:id — remove a tournament and its entries
export async function DELETE(request, { params }) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  await connectDB()
  try {
    await Tournament.findByIdAndDelete(params.id)
    await TournamentEntry.deleteMany({ tournamentId: params.id })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
