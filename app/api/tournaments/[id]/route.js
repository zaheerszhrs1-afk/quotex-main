import { NextResponse } from 'next/server'
const connectDB = require('@/lib/db')
const Tournament = require('@/lib/models/Tournament')
const TournamentEntry = require('@/lib/models/TournamentEntry')
const DepositRequest = require('@/lib/models/DepositRequest')
const User = require('@/lib/models/User')
const { getUserFromRequest } = require('@/lib/serverAuth')
const { serializeTournament, buildLeaderboard } = require('@/lib/tournamentHelpers')

export const dynamic = 'force-dynamic'

// GET /api/tournaments/:id — full detail with the ranked leaderboard, plus the
// requesting user's join + deposit status.
export async function GET(request, { params }) {
  await connectDB()
  let tournament
  try {
    tournament = await Tournament.findById(params.id).lean()
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (!tournament) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const entries = await TournamentEntry.find({ tournamentId: tournament._id }).lean()
  const users = await User.find({ _id: { $in: entries.map((e) => e.userId) } }).select('email country').lean()
  const userMap = Object.fromEntries(users.map((u) => [u._id.toString(), u]))

  let joined = false
  let hasDeposited = false
  let myUserId = null
  const me = await getUserFromRequest(request).catch(() => null)
  if (me) {
    myUserId = me._id
    joined = entries.some((e) => e.userId.toString() === me._id.toString())
    hasDeposited = !!(await DepositRequest.exists({ userId: me._id, status: 'approved' }))
  }

  const leaderboard = buildLeaderboard(tournament, entries, userMap, myUserId)

  return NextResponse.json({
    tournament: serializeTournament(tournament, {
      participants: leaderboard.length,
      joined,
    }),
    hasDeposited,
    leaderboard,
  })
}
