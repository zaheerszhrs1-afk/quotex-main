import { NextResponse } from 'next/server'
const connectDB = require('@/lib/db')
const Tournament = require('@/lib/models/Tournament')
const TournamentEntry = require('@/lib/models/TournamentEntry')
const DepositRequest = require('@/lib/models/DepositRequest')
const { getUserFromRequest } = require('@/lib/serverAuth')
const { serializeTournament } = require('@/lib/tournamentHelpers')

export const dynamic = 'force-dynamic'

// GET /api/tournaments — all active tournaments with derived status, the
// participant count, whether the requesting user joined, and whether they have
// ever made an (approved) real deposit (gates joining free tournaments).
export async function GET(request) {
  await connectDB()
  const tournaments = await Tournament.find({ isActive: true }).sort({ startTime: 1 }).lean()

  const ids = tournaments.map((t) => t._id)
  const counts = await TournamentEntry.aggregate([
    { $match: { tournamentId: { $in: ids } } },
    { $group: { _id: '$tournamentId', n: { $sum: 1 } } },
  ])
  const countMap = Object.fromEntries(counts.map((c) => [c._id.toString(), c.n]))

  let joinedSet = new Set()
  let hasDeposited = false
  const me = await getUserFromRequest(request).catch(() => null)
  if (me) {
    const mine = await TournamentEntry.find({ userId: me._id, tournamentId: { $in: ids } }).select('tournamentId').lean()
    joinedSet = new Set(mine.map((m) => m.tournamentId.toString()))
    hasDeposited = !!(await DepositRequest.exists({ userId: me._id, status: 'approved' }))
  }

  return NextResponse.json({
    hasDeposited,
    tournaments: tournaments.map((t) =>
      serializeTournament(t, {
        participants: (countMap[t._id.toString()] || 0) + 12, // include synthetic padding in the headline count
        joined: joinedSet.has(t._id.toString()),
      })
    ),
  })
}
