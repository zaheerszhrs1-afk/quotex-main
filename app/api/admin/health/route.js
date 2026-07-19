import { NextResponse } from 'next/server'
const { requireAdmin } = require('@/lib/requireAdmin')

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:5001'

export async function GET(request) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const res = await fetch(`${WS_URL}/health/metrics`, { cache: 'no-store' })
    if (!res.ok) throw new Error(`WS health returned ${res.status}`)
    const data = await res.json()
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json(
      {
        error: 'WS server unreachable',
        message: e.message,
        uptimeSeconds: 0,
        connections: 0,
        rooms: 0,
        openTrades: 0,
        sentPerSec: 0,
        recvPerSec: 0,
        reconnectsPerSec: 0,
        tickMs: 0,
        tickAvgMs: 0,
        memoryMb: 0,
        heapMb: 0,
        slowEvents: [],
        history: [],
      },
      { status: 503 }
    )
  }
}
