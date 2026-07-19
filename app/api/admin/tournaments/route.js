import { NextResponse } from 'next/server'
const connectDB = require('@/lib/db')
const Tournament = require('@/lib/models/Tournament')
const TournamentEntry = require('@/lib/models/TournamentEntry')
const { requireAdmin } = require('@/lib/requireAdmin')
const { serializeTournament } = require('@/lib/tournamentHelpers')

const DEFAULT_LIMIT = 20

// GET /api/admin/tournaments — all tournaments (incl. hidden) with entry counts
export async function GET(request) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  await connectDB()

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || DEFAULT_LIMIT))

  const [total, tournaments] = await Promise.all([
    Tournament.countDocuments(),
    Tournament.find().sort({ startTime: -1 }).skip((page - 1) * limit).limit(limit).lean(),
  ])

  const tournamentIds = tournaments.map((t) => t._id)
  const counts = await TournamentEntry.aggregate([
    { $match: { tournamentId: { $in: tournamentIds } } },
    { $group: { _id: '$tournamentId', n: { $sum: 1 } } },
  ])
  const countMap = Object.fromEntries(counts.map((c) => [c._id.toString(), c.n]))

  return NextResponse.json({
    tournaments: tournaments.map((t) =>
      serializeTournament(t, { participants: countMap[t._id.toString()] || 0 })
    ),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
}

// POST /api/admin/tournaments — create a tournament
export async function POST(request) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  await connectDB()
  const body = await request.json()

  const name = String(body.name || '').trim()
  if (!name) return NextResponse.json({ error: 'Name is required.' }, { status: 400 })
  const startTime = new Date(body.startTime)
  const endTime = new Date(body.endTime)
  if (isNaN(startTime) || isNaN(endTime)) return NextResponse.json({ error: 'Valid start and end times are required.' }, { status: 400 })
  if (endTime <= startTime) return NextResponse.json({ error: 'End time must be after start time.' }, { status: 400 })

  const t = await Tournament.create({
    name,
    description: String(body.description || ''),
    prizePool: Number(body.prizePool) || 0,
    entryFee: Number(body.entryFee) || 0,
    rebuyCost: Number(body.rebuyCost) || 0,
    rebuys: Number(body.rebuys) || 0,
    startBalance: Number(body.startBalance) || 10000,
    startTime,
    endTime,
    prizes: Array.isArray(body.prizes) ? body.prizes.map(Number).filter((n) => !isNaN(n)) : [],
    isActive: body.isActive == null ? true : Boolean(body.isActive),
  })
  return NextResponse.json({ tournament: serializeTournament(t.toObject(), { participants: 0 }) })
}
