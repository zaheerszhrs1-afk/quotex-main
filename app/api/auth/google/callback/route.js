import { NextResponse } from 'next/server'
const connectDB = require('@/lib/db')
const User = require('@/lib/models/User')
const { setAuthCookies } = require('@/lib/auth')

export const dynamic = 'force-dynamic'

// Behind a reverse proxy (Dokploy/Traefik) request.url's host is the internal
// "localhost" — using it would redirect the user to localhost after login. Build
// the real public origin from the forwarded headers (or an explicit override).
function publicOrigin(request, url) {
  if (process.env.APP_ORIGIN) return process.env.APP_ORIGIN.replace(/\/$/, '')
  const h = request.headers
  const host = h.get('x-forwarded-host') || h.get('host')
  const proto = h.get('x-forwarded-proto') || (url.protocol === 'http:' ? 'http' : 'https')
  return host ? `${proto}://${host}` : url.origin
}

// GET /api/auth/google/callback?code=...&state=...
// Exchanges the authorization code for tokens, reads the Google profile, finds
// or creates the matching user, sets our JWT cookies, and redirects on.
export async function GET(request) {
  const url = new URL(request.url)
  const origin = publicOrigin(request, url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const savedState = request.cookies.get('qx_oauth_state')?.value
  const next = request.cookies.get('qx_oauth_next')?.value || '/en/trade'

  const fail = (msg) => {
    const res = NextResponse.redirect(`${origin}/en/sign-in?error=${encodeURIComponent(msg)}`)
    res.cookies.delete('qx_oauth_state')
    res.cookies.delete('qx_oauth_next')
    return res
  }

  if (url.searchParams.get('error')) return fail('Google sign-in was cancelled.')
  if (!code || !state || !savedState || state !== savedState) return fail('Google sign-in failed. Please try again.')

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) return fail('Google sign-in is coming soon.')

  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${origin}/api/auth/google/callback`

  try {
    // 1) exchange the code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })
    const tokens = await tokenRes.json()
    if (!tokenRes.ok || !tokens.access_token) return fail('Could not verify your Google account.')

    // 2) fetch the profile
    const profRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const profile = await profRes.json()
    if (!profRes.ok || !profile.email) return fail('Could not read your Google profile.')

    const email = String(profile.email).toLowerCase().trim()

    await connectDB()
    // match by googleId first, then by email (link an existing password account)
    let user = await User.findOne({ $or: [{ googleId: profile.id }, { email }] })
    if (user) {
      let changed = false
      if (!user.googleId) { user.googleId = profile.id; changed = true }
      if (!user.avatar && profile.picture) { user.avatar = profile.picture; changed = true }
      if (!user.firstName && profile.given_name) { user.firstName = profile.given_name; changed = true }
      if (!user.lastName && profile.family_name) { user.lastName = profile.family_name; changed = true }
      if (changed) await user.save()
    } else {
      user = await User.create({
        email,
        googleId: profile.id,
        avatar: profile.picture || '',
        firstName: profile.given_name || '',
        lastName: profile.family_name || '',
        // OAuth-only account: random unusable password hash placeholder
        passwordHash: '',
      })
    }

    if (user.isBanned) return fail('This account has been suspended.')

    const res = NextResponse.redirect(`${origin}${next.startsWith('/') ? next : '/en/trade'}`)
    res.cookies.delete('qx_oauth_state')
    res.cookies.delete('qx_oauth_next')
    setAuthCookies(res, user)
    return res
  } catch (err) {
    console.error('[google callback]', err)
    return fail('Google sign-in failed. Please try again.')
  }
}
