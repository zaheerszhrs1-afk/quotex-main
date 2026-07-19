import { NextResponse } from 'next/server'
const connectDB = require('@/lib/db')
const User = require('@/lib/models/User')
const {
  hashPassword,
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
    const country = body.country || ''
    const currency = body.currency || 'USD'

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email.' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters.' },
        { status: 400 }
      )
    }

    await connectDB()
    const existing = await User.findOne({ email })
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 })
    }

    const passwordHash = await hashPassword(password)
    const user = await User.create({ email, passwordHash, country, currency })

    const accessToken = signAccessToken({ sub: user._id.toString(), role: user.role })
    const refreshToken = signRefreshToken({ sub: user._id.toString() })

    const res = NextResponse.json({ user: user.toSafeJSON() })
    res.cookies.set(COOKIE.ACCESS, accessToken, accessCookieOptions())
    res.cookies.set(COOKIE.REFRESH, refreshToken, refreshCookieOptions())
    return res
  } catch (err) {
    console.error('[signup]', err)
    // duplicate key (email already taken, or a legacy googleId:null collision)
    if (err?.code === 11000) {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Something went wrong. Is the database running?' }, { status: 500 })
  }
}
