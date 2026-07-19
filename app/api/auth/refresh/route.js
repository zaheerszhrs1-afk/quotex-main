import { NextResponse } from 'next/server'
const connectDB = require('@/lib/db')
const User = require('@/lib/models/User')
const {
  verifyRefreshToken,
  signAccessToken,
  signRefreshToken,
  accessCookieOptions,
  refreshCookieOptions,
  COOKIE,
} = require('@/lib/auth')

export async function POST(request) {
  try {
    const token = request.cookies.get(COOKIE.REFRESH)?.value
    const payload = token ? verifyRefreshToken(token) : null
    if (!payload?.sub) {
      return clearSession()
    }
    await connectDB()
    const user = await User.findById(payload.sub)
    if (!user || user.isBanned) {
      return clearSession()
    }

    const accessToken = signAccessToken({ sub: user._id.toString(), role: user.role })
    const refreshToken = signRefreshToken({ sub: user._id.toString() })

    const res = NextResponse.json({ user: user.toSafeJSON() })
    res.cookies.set(COOKIE.ACCESS, accessToken, accessCookieOptions())
    res.cookies.set(COOKIE.REFRESH, refreshToken, refreshCookieOptions())
    return res
  } catch (err) {
    console.error('[refresh]', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}

// Clears stale cookies so middleware stops treating the request as logged-in.
function clearSession() {
  const res = NextResponse.json({ error: 'Not authenticated.', user: null }, { status: 401 })
  res.cookies.set(COOKIE.ACCESS, '', { path: '/', maxAge: 0 })
  res.cookies.set(COOKIE.REFRESH, '', { path: '/', maxAge: 0 })
  return res
}
