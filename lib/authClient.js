'use client'

// Resolves the current user, transparently refreshing the 15-min access token
// from the 7-day refresh cookie when it has expired. Returns the user or null.
export async function fetchMe() {
  try {
    const r = await fetch('/api/auth/me')
    const d = await r.json()
    if (d.user) return d.user
    // access token missing/expired — try the refresh cookie
    const rr = await fetch('/api/auth/refresh', { method: 'POST' })
    if (!rr.ok) return null
    const dd = await rr.json()
    return dd.user || null
  } catch {
    return null
  }
}
