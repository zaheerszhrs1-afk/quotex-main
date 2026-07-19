import { NextResponse } from 'next/server'
const { COOKIE } = require('@/lib/auth')

export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE.ACCESS, '', { path: '/', maxAge: 0 })
  res.cookies.set(COOKIE.REFRESH, '', { path: '/', maxAge: 0 })
  return res
}
