import { NextResponse } from 'next/server'
const connectDB = require('@/lib/db')
const User = require('@/lib/models/User')
const { getUserFromRequest } = require('@/lib/serverAuth')
const {
  verifyRefreshToken,
  signAccessToken,
  signRefreshToken,
  accessCookieOptions,
  refreshCookieOptions,
  COOKIE,
} = require('@/lib/auth')

export const dynamic = 'force-dynamic'

// Returns a short-lived token the browser hands to the Socket.io server (the
// httpOnly auth cookie can't be read by JS / sent cross-origin to :5001).
// Falls back to the 7-day refresh cookie when the 15-min access token has
// expired, so long-lived sessions keep their socket authenticated.
export async function GET(request) {
  const user = await getUserFromRequest(request)
  if (user) {
    const token = signAccessToken({ sub: user._id.toString(), role: user.role })
    return noStore(NextResponse.json({ token }))
  }

  // access token missing/expired — try the refresh cookie
  const refresh = request.cookies.get(COOKIE.REFRESH)?.value
  const payload = refresh ? verifyRefreshToken(refresh) : null
  if (!payload?.sub) return noStore(NextResponse.json({ token: null }))

  await connectDB()
  const fresh = await User.findById(payload.sub)
  if (!fresh || fresh.isBanned) return noStore(NextResponse.json({ token: null }))

  const token = signAccessToken({ sub: fresh._id.toString(), role: fresh.role })
  const res = NextResponse.json({ token })
  // refresh the rolling cookies so subsequent requests stay authenticated too
  res.cookies.set(COOKIE.ACCESS, token, accessCookieOptions())
  res.cookies.set(COOKIE.REFRESH, signRefreshToken({ sub: fresh._id.toString() }), refreshCookieOptions())
  return noStore(res)
}

function noStore(res) {
  res.headers.set('Cache-Control', 'no-store, max-age=0')
  return res
}
