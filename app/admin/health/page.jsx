'use client'
import { useEffect, useRef, useState } from 'react'
import { getSocket } from '@/lib/socketClient'

function fmtDuration(totalSeconds) {
  const s = Math.max(0, totalSeconds)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m ${sec}s`
  return `${m}m ${sec}s`
}

function Sparkline({ data, width = 280, height = 60, color = '#00C076', fill = true }) {
  if (!data || data.length < 2) {
    return (
      <div className="flex items-center justify-center text-[10px] text-qx-textMute" style={{ width, height }}>
        collecting…
      </div>
    )
  }
  const vals = data.map((d) => d.v)
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const range = max - min || 1
  const n = vals.length
  const points = vals.map((v, i) => {
    const x = (i / (n - 1)) * width
    const y = height - ((v - min) / range) * height
    return `${x},${y}`
  })
  const area = `${points[0].split(',')[0]},${height} ` + points.join(' ') + ` ${points[points.length - 1].split(',')[0]},${height}`
  return (
    <svg width={width} height={height} className="overflow-visible">
      {fill && <polygon points={area} fill={`${color}20`} stroke="none" />}
      <polyline points={points.join(' ')} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export default function AdminHealth() {
  const [metrics, setMetrics] = useState(null)
  const [err, setErr] = useState('')
  const [connected, setConnected] = useState(false)
  const sockRef = useRef(null)

  // initial snapshot from HTTP (works even if socket not yet ready)
  useEffect(() => {
    fetch('/api/admin/health')
      .then((r) => r.json())
      .then((d) => {
        if (d.error && !d.connections && !d.history?.length) setErr(d.error)
        else setMetrics(d)
      })
      .catch(() => setErr('Failed to load health snapshot.'))
  }, [])

  // real-time updates via admin socket
  useEffect(() => {
    let on = true
    const onMetrics = (m) => {
      if (!on) return
      setMetrics(m)
      setErr('')
    }
    const onConnect = () => {
      if (!on) return
      setConnected(true)
      sockRef.current?.emit('admin:metrics')
    }
    const onDisconnect = () => {
      if (!on) return
      setConnected(false)
    }

    getSocket().then((s) => {
      if (!on) return
      sockRef.current = s
      s.on('admin:metrics', onMetrics)
      s.on('connect', onConnect)
      s.on('disconnect', onDisconnect)
      setConnected(s.connected)
      if (s.connected) s.emit('admin:metrics')
    })

    return () => {
      on = false
      const s = sockRef.current
      if (s) {
        s.off('admin:metrics', onMetrics)
        s.off('connect', onConnect)
        s.off('disconnect', onDisconnect)
      }
    }
  }, [])

  if (err && !metrics) return <p className="text-qx-red">{err}</p>
  if (!metrics) return <p className="text-qx-textDim">Loading health metrics…</p>

  const connHistory = (metrics.history || []).map((h) => ({ t: h.t, v: h.connections }))
  const sentHistory = (metrics.history || []).map((h) => ({ t: h.t, v: h.sentPerSec }))
  const recvHistory = (metrics.history || []).map((h) => ({ t: h.t, v: h.recvPerSec }))
  const tickHistory = (metrics.history || []).map((h) => ({ t: h.t, v: h.tickMs }))

  const cards = [
    {
      label: 'Active connections',
      value: metrics.connections.toLocaleString(),
      sub: `${metrics.rooms.toLocaleString()} rooms · ${metrics.openTrades} open trades`,
      spark: connHistory,
      color: '#2F8FEE',
    },
    {
      label: 'Messages / sec',
      value: `${metrics.sentPerSec.toLocaleString()} / ${metrics.recvPerSec.toLocaleString()}`,
      sub: `sent / received · ${metrics.reconnectsPerSec} reconnects/s`,
      spark: sentHistory,
      color: '#00C076',
    },
    {
      label: 'Tick loop',
      value: `${metrics.tickMs.toFixed(2)} ms`,
      sub: `avg ${metrics.tickAvgMs.toFixed(2)} ms (target ≤ ${250} ms)`,
      spark: tickHistory,
      color: metrics.tickMs > 200 ? '#FF6258' : '#F5B70A',
    },
    {
      label: 'Memory',
      value: `${metrics.memoryMb.toFixed(1)} MB`,
      sub: `heap ${metrics.heapMb.toFixed(1)} MB · uptime ${fmtDuration(metrics.uptimeSeconds)}`,
      spark: (metrics.history || []).map((h) => ({ t: h.t, v: h.memoryMb })),
      color: '#9B59B6',
    },
  ]

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Server health</h1>
        <div className="flex items-center gap-3">
          {err && <span className="text-sm text-qx-red">{err}</span>}
          <span className={`flex items-center gap-2 text-sm font-semibold ${connected ? 'text-qx-green' : 'text-qx-textMute'}`}>
            <span className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-qx-green' : 'bg-qx-textMute'}`} />
            {connected ? 'Live metrics' : 'Socket offline'}
          </span>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="qx-card flex flex-col p-4">
            <div className="text-xs text-qx-textDim">{c.label}</div>
            <div className="mt-1 text-2xl font-extrabold" style={{ color: c.color }}>
              {c.value}
            </div>
            <div className="mb-2 text-[11px] text-qx-textMute">{c.sub}</div>
            <div className="mt-auto">
              <Sparkline data={c.spark} color={c.color} />
            </div>
          </div>
        ))}
      </div>

      {metrics.feedStatus?.length > 0 && (
        <div className="mb-6 qx-card p-4">
          <h2 className="mb-3 font-bold">Live market feeds</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {metrics.feedStatus.map((f) => {
              const stale = !f.lastTickAt || Date.now() - f.lastTickAt > 10000
              return (
                <div key={f.symbol} className="rounded-lg bg-qx-panel2 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">{f.symbol}</span>
                    <span className={`text-[10px] font-bold uppercase ${stale ? 'text-qx-red' : 'text-qx-green'}`}>
                      {stale ? 'stale' : 'live'}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-qx-textDim">{f.provider}</div>
                  <div className="mt-1 text-sm tabular-nums text-white">{f.livePrice != null ? f.livePrice.toFixed(4) : '—'}</div>
                  <div className="text-[10px] text-qx-textMute">{f.bufferedTicks} buffered ticks</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="qx-card p-4">
          <h2 className="mb-3 font-bold">Throughput sparklines</h2>
          <div className="space-y-4">
            <SparkRow label="Connections" data={connHistory} color="#2F8FEE" />
            <SparkRow label="Sent / sec" data={sentHistory} color="#00C076" />
            <SparkRow label="Received / sec" data={recvHistory} color="#F5B70A" />
            <SparkRow label="Tick loop ms" data={tickHistory} color="#FF6258" />
          </div>
        </div>

        <div className="qx-card p-4">
          <h2 className="mb-3 font-bold">Slowest event handlers</h2>
          {!metrics.slowEvents?.length ? (
            <p className="text-sm text-qx-textMute">No event timing data yet. It appears as handlers are called.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-qx-border text-left text-qx-textMute">
                    <th className="py-2 pr-4 font-semibold">Event</th>
                    <th className="py-2 pr-4 font-semibold">Calls</th>
                    <th className="py-2 pr-4 font-semibold">Avg ms</th>
                    <th className="py-2 font-semibold">Max ms</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.slowEvents.map((e) => (
                    <tr key={e.name} className="border-b border-qx-border/50">
                      <td className="py-2 pr-4 font-medium text-white">{e.name}</td>
                      <td className="py-2 pr-4 text-qx-textDim">{e.count.toLocaleString()}</td>
                      <td className="py-2 pr-4 text-qx-textDim">{e.avgMs.toFixed(2)}</td>
                      <td className={`py-2 font-semibold ${e.maxMs > 100 ? 'text-qx-red' : 'text-qx-textDim'}`}>
                        {e.maxMs.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 qx-card p-4">
        <h2 className="mb-3 font-bold">What to watch</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-qx-textDim">
          <li>
            <b className="text-white">Tick loop &gt; 200 ms</b> — server is struggling to finish one 250 ms cycle. Time to scale or optimize broadcasts.
          </li>
          <li>
            <b className="text-white">Reconnects / sec &gt; 5-10</b> — users are dropping and coming back. Usually network/proxy issues, not server load.
          </li>
          <li>
            <b className="text-white">Messages / sec keeps climbing with same users</b> — possible room leak (users not unsubscribing on chart switch).
          </li>
          <li>
            <b className="text-white">Memory climbing steadily</b> — check for leaks in buffers or open trade snapshots.
          </li>
          <li>
            <b className="text-white">Event max ms &gt; 1000</b> — that handler is blocking the event loop. Usually DB queries or heavy loops.
          </li>
        </ul>
      </div>
    </div>
  )
}

function SparkRow({ label, data, color }) {
  const latest = data[data.length - 1]?.v ?? 0
  const max = data.length ? Math.max(...data.map((d) => d.v)) : 0
  return (
    <div className="flex items-center gap-4">
      <div className="w-28 shrink-0">
        <div className="text-xs text-qx-textDim">{label}</div>
        <div className="text-sm font-bold tabular-nums" style={{ color }}>
          {latest.toLocaleString()}
        </div>
        <div className="text-[10px] text-qx-textMute">max {max.toLocaleString()}</div>
      </div>
      <div className="flex-1">
        <Sparkline data={data} color={color} width={320} height={44} />
      </div>
    </div>
  )
}
