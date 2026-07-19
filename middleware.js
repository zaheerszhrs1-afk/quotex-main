import { NextResponse } from 'next/server'

// Edge middleware: lightweight routing guard only. It checks cookie presence and
// (best-effort) decodes the JWT payload to read the role for /admin redirects.
// Authoritative verification happens in API routes / server (getUserFromRequest).

function decodePayload(token) {
  try {
    const part = token.split('.')[1]
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(json)
  } catch {
    return null
  }
}

export function middleware(req) {
  const { pathname } = req.nextUrl
  const access = req.cookies.get('qx_access')?.value
  const refresh = req.cookies.get('qx_refresh')?.value
  const hasSession = Boolean(access || refresh)

  // root / -> send to auth (or terminal if logged in). Home page itself is
  // intentionally not public.
  if (pathname === '/') {
    const url = req.nextUrl.clone()
    url.pathname = hasSession ? '/en/trade' : '/en/sign-in'
    url.search = ''
    return NextResponse.redirect(url)
  }

  // the admin login page lives under /admin but must stay reachable while logged
  // out — otherwise the guard below bounces it to /en/sign-in in a loop.
  if (pathname.startsWith('/admin/sign-in')) {
    return NextResponse.next()
  }

  if (pathname.startsWith('/admin')) {
    if (!hasSession) {
      const url = req.nextUrl.clone()
      url.pathname = '/en/sign-in'
      url.searchParams.set('next', pathname)
      return NextResponse.redirect(url)
    }
    // best-effort role gate (real check is server-side)
    const payload = access ? decodePayload(access) : null
    if (payload && payload.role !== 'admin') {
      const url = req.nextUrl.clone()
      url.pathname = '/en/trade'
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  }

  if (pathname.startsWith('/en/trade')) {
    if (!hasSession) {
      const url = req.nextUrl.clone()
      url.pathname = '/en/sign-in'
      url.searchParams.set('next', pathname)
      return NextResponse.redirect(url)
    }
    // admins live in the admin panel — they should never reach the user
    // terminal. Bounce them back to /admin so they can't trade/steer from
    // the client side.
    const payload = access ? decodePayload(access) : null
    if (payload && payload.role === 'admin') {
      const url = req.nextUrl.clone()
      url.pathname = '/admin'
      url.search = ''
      return NextResponse.redirect(url)
    }
  }

  // already logged in? skip the auth pages and go straight to the terminal
  // (or the admin panel for admins)
  if (pathname.startsWith('/en/sign-in') || pathname.startsWith('/en/sign-up')) {
    if (hasSession) {
      const payload = access ? decodePayload(access) : null
      const url = req.nextUrl.clone()
      url.pathname = payload && payload.role === 'admin' ? '/admin' : '/en/trade'
      url.search = ''
      return NextResponse.redirect(url)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/admin/:path*', '/en/trade/:path*', '/en/sign-in', '/en/sign-up'],
}
