import { NextResponse } from 'next/server'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

// Behind a reverse proxy request.url's host is the internal "localhost"; derive
// the real public origin from the forwarded headers (or an explicit override).
function publicOrigin(request, url) {
  if (process.env.APP_ORIGIN) return process.env.APP_ORIGIN.replace(/\/$/, '')
  const h = request.headers
  const host = h.get('x-forwarded-host') || h.get('host')
  const proto = h.get('x-forwarded-proto') || (url.protocol === 'http:' ? 'http' : 'https')
  return host ? `${proto}://${host}` : url.origin
}

// GET /api/auth/google?next=/en/trade
// Kicks off Google's OAuth 2.0 Authorization Code flow: redirects the browser
// to Google's consent screen. A random `state` (stored in a short-lived cookie)
// protects against CSRF; the post-login redirect target is carried in a cookie.
export async function GET(request) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const url = new URL(request.url)
  const origin = publicOrigin(request, url)
  const next = url.searchParams.get('next') || '/en/trade'

  if (!clientId) {
    // not configured — send the user back with a friendly message
    return NextResponse.redirect(`${origin}/en/sign-in?error=${encodeURIComponent('Google sign-in is coming soon.')}`)
  }

  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${origin}/api/auth/google/callback`
  const state = crypto.randomBytes(16).toString('hex')

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'offline',
    prompt: 'select_account',
  })

  const res = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`)
  const cookieOpts = { httpOnly: true, sameSite: 'lax', secure: origin.startsWith('https'), path: '/', maxAge: 600 }
  res.cookies.set('qx_oauth_state', state, cookieOpts)
  res.cookies.set('qx_oauth_next', next, cookieOpts)
  return res
}
