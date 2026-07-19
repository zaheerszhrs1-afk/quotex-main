import { NextResponse } from 'next/server'
const connectDB = require('@/lib/db')
const User = require('@/lib/models/User')
const {
  comparePassword,
  signAccessToken,
  signRefreshToken,
  accessCookieOptions,
  refreshCookieOptions,
  COOKIE,
} = require('@/lib/auth')

export async function POST(request) {
  try {
    const body = await request.json()
    const email = (body.email || '').toLowerCase().trim()
    const password = body.password || ''
    const adminScope = body.scope === 'admin'

    await connectDB()
    const user = await User.findOne({ email })
    if (!user || !(await comparePassword(password, user.passwordHash))) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
    }
    if (user.isBanned) {
      return NextResponse.json({ error: 'This account has been suspended.' }, { status: 403 })
    }
    // The admin sign-in page only lets administrators through; a regular user
    // who tries to log in there is rejected (their credentials are valid but
    // they have no admin access).
    if (adminScope && user.role !== 'admin') {
      return NextResponse.json({ error: 'This is not an administrator account.' }, { status: 403 })
    }

    const accessToken = signAccessToken({ sub: user._id.toString(), role: user.role })
    const refreshToken = signRefreshToken({ sub: user._id.toString() })

    const res = NextResponse.json({ user: user.toSafeJSON() })
    res.cookies.set(COOKIE.ACCESS, accessToken, accessCookieOptions())
    res.cookies.set(COOKIE.REFRESH, refreshToken, refreshCookieOptions())
    return res
  } catch (err) {
    console.error('[login]', err)
    return NextResponse.json({ error: 'Something went wrong. Is the database running?' }, { status: 500 })
  }
}
