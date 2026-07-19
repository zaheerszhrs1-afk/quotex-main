import { NextResponse } from 'next/server'
const { getUserFromRequest } = require('@/lib/serverAuth')

// POST /api/auth/profile — update the current user's editable profile fields
// (My account). Only whitelisted fields are accepted.
export async function POST(request) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  let body = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const str = (v, max = 80) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined)
  const updates = {
    firstName: str(body.firstName),
    lastName: str(body.lastName),
    dob: str(body.dob, 10),
    address: str(body.address, 200),
    country: str(body.country, 80),
  }
  for (const [k, v] of Object.entries(updates)) {
    if (v !== undefined) user[k] = v
  }
  await user.save()

  return NextResponse.json({ user: user.toSafeJSON() })
}
