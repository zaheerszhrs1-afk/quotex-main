import { NextResponse } from 'next/server'
const { getUserFromRequest } = require('@/lib/serverAuth')

export async function GET(request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ user: null }, { status: 200 })
    return NextResponse.json({ user: user.toSafeJSON() })
  } catch (err) {
    return NextResponse.json({ user: null }, { status: 200 })
  }
}
