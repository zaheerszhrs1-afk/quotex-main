// Auth helpers: password hashing + JWT signing/verifying + cookie helpers.
// Shared by Next.js API routes and the Express/Socket.io server.
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey123'
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'supersecretrefresh456'

const ACCESS_TTL = '15m'
const REFRESH_TTL = '7d'

const COOKIE = {
  ACCESS: 'qx_access',
  REFRESH: 'qx_refresh',
}

async function hashPassword(pw) {
  return bcrypt.hash(pw, 10)
}
async function comparePassword(pw, hash) {
  return bcrypt.compare(pw, hash)
}

function signAccessToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TTL })
}
function signRefreshToken(payload) {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TTL })
}
function verifyAccessToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch {
    return null
  }
}
function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET)
  } catch {
    return null
  }
}

// Secure cookies only work over HTTPS — browsers drop them on http:// sites.
// Default: secure in production, but COOKIE_SECURE=false overrides this for
// HTTP test deployments (e.g. a generated sslip.io domain without TLS).
function secureCookies() {
  if (process.env.COOKIE_SECURE != null) return process.env.COOKIE_SECURE === 'true'
  return process.env.NODE_ENV === 'production'
}

// Cookie option builder for Next.js cookies().set(...)
function accessCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: secureCookies(),
    path: '/',
    maxAge: 60 * 15, // 15 min
  }
}
function refreshCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: secureCookies(),
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  }
}

// Issue both auth cookies for a user on a NextResponse (login / signup / OAuth).
function setAuthCookies(res, user) {
  const accessToken = signAccessToken({ sub: user._id.toString(), role: user.role })
  const refreshToken = signRefreshToken({ sub: user._id.toString() })
  res.cookies.set(COOKIE.ACCESS, accessToken, accessCookieOptions())
  res.cookies.set(COOKIE.REFRESH, refreshToken, refreshCookieOptions())
  return res
}

module.exports = {
  JWT_SECRET,
  JWT_REFRESH_SECRET,
  COOKIE,
  hashPassword,
  comparePassword,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  accessCookieOptions,
  refreshCookieOptions,
  setAuthCookies,
}
