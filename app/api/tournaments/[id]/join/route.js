import { NextResponse } from 'next/server'
const connectDB = require('@/lib/db')
const Tournament = require('@/lib/models/Tournament')
const { tournamentStatus } = require('@/lib/models/Tournament')
const TournamentEntry = require('@/lib/models/TournamentEntry')
const DepositRequest = require('@/lib/models/DepositRequest')
const { getUserFromRequest } = require('@/lib/serverAuth')

export const dynamic = 'force-dynamic'

// POST /api/tournaments/:id/join — join a tournament. Mirrors Quotex's rule:
// you must have deposited a real account at least once (an approved deposit).
// Paid tournaments also charge the entry fee from the real balance.
export async function POST(request, { params }) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  await connectDB()
  let tournament
  try {
    tournament = await Tournament.findById(params.id)
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (!tournament || !tournament.isActive) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (tournamentStatus(tournament) === 'completed') {
    return NextResponse.json({ error: 'This tournament has already ended.' }, { status: 400 })
  }

  const existing = await TournamentEntry.findOne({ tournamentId: tournament._id, userId: user._id })
  if (existing) {
    return NextResponse.json({ error: 'You have already joined this tournament.' }, { status: 400 })
  }

  // gate: real deposit required at least once
  const hasDeposited = await DepositRequest.exists({ userId: user._id, status: 'approved' })
  if (!hasDeposited) {
    return NextResponse.json(
      { error: 'To participate, you need to deposit a real account at least once.', code: 'DEPOSIT_REQUIRED' },
      { status: 403 }
    )
  }

  // paid tournaments charge the entry fee from the real balance
  const fee = Number(tournament.entryFee) || 0
  if (fee > 0) {
    if (user.realBalance < fee) {
      return NextResponse.json({ error: 'Insufficient real balance for the entry fee.' }, { status: 400 })
    }
    user.realBalance -= fee
    await user.save()
  }

  try {
    await TournamentEntry.create({
      tournamentId: tournament._id,
      userId: user._id,
      balance: tournament.startBalance,
    })
  } catch (e) {
    // unique-index race: someone double-clicked
    if (e.code === 11000) return NextResponse.json({ error: 'You have already joined this tournament.' }, { status: 400 })
    throw e
  }

  return NextResponse.json({ ok: true, realBalance: user.realBalance })
}
