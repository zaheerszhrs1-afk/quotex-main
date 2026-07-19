'use client'
import { io } from 'socket.io-client'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:5001'

let socket = null

// Fetches a short-lived socket token. If the access cookie has expired the
// endpoint returns null, so we transparently refresh (from the 7-day refresh
// cookie) and retry once. Always bypasses any HTTP/service-worker cache so we
// never hand the server a stale/expired token.
async function freshToken() {
  try {
    let res = await fetch('/api/socket-token', { cache: 'no-store' })
    let token = (await res.json()).token
    if (token) return token
    // access token missing/expired — refresh then retry
    await fetch('/api/auth/refresh', { method: 'POST' })
    res = await fetch('/api/socket-token', { cache: 'no-store' })
    return (await res.json()).token || null
  } catch {
    return null /* anonymous (view-only) connection */
  }
}

// Connects once and reuses the connection. The `auth` callback runs on every
// connection attempt — including socket.io's automatic reconnects — so the
// server always receives a *fresh* token. This fixes the production bug where,
// after the 15-min access token expired, a reconnect would re-authenticate as
// anonymous and trades failed with "Please log in to trade." until a reload.
export async function getSocket() {
  if (socket) return socket

  socket = io(WS_URL, {
    transports: ['websocket', 'polling'],
    withCredentials: true,
    auth: (cb) => {
      freshToken().then((token) => cb({ token }))
    },
  })

  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
