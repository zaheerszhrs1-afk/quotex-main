'use client'
import { useEffect, useState } from 'react'

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [pnl, setPnl] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    fetch('/api/admin/stats')
      .then((r) => r.json())
      .then((d) => (d.error ? setErr(d.error) : setStats(d)))
      .catch(() => setErr('Failed to load stats.'))
    fetch('/api/admin/pnl')
      .then((r) => r.json())
      .then((d) => (d.error ? null : setPnl(d)))
      .catch(() => {})
  }, [])

  if (err) return <p className="text-qx-red">{err}</p>
  if (!stats) return <p className="text-qx-textDim">Loading…</p>

  const cards = [
    { label: 'Total Users', value: stats.totalUsers, color: 'text-white' },
    { label: 'Total Deposits', value: `$${stats.totalDeposits.toLocaleString()}`, color: 'text-qx-green' },
    { label: 'Total Withdrawals', value: `$${stats.totalWithdrawals.toLocaleString()}`, color: 'text-qx-red' },
    { label: 'Active Trades', value: stats.activeTrades, color: 'text-qx-gold' },
    { label: 'Platform Profit', value: `$${stats.platformProfit.toLocaleString()}`, color: 'text-qx-green' },
  ]

  return (
    <div>
      <h1 className="mb-5 text-2xl font-bold">Dashboard</h1>
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="qx-card p-4">
            <div className="text-xs text-qx-textDim">{c.label}</div>
            <div className={`mt-1 text-2xl font-extrabold ${c.color}`}>{c.value}</div>
          </div>
        ))}
      </div>

      <PnlPanel pnl={pnl} />

      <div className="grid gap-6 lg:grid-cols-2">
        <RecentTable title="Recent deposits" rows={stats.recentDeposits} />
        <RecentTable title="Recent withdrawals" rows={stats.recentWithdrawals} />
      </div>
    </div>
  )
}

// House P&L on real-money trades across rolling windows. The whole point of the
// auto-profit engine is invisible without a scoreboard — this is it.
function PnlPanel({ pnl }) {
  const windows = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'Last 7 days' },
    { key: 'month', label: 'Last 30 days' },
    { key: 'all', label: 'All time' },
  ]
  return (
    <div className="mb-6">
      <h2 className="mb-3 text-lg font-bold">House P&amp;L <span className="text-xs font-normal text-qx-textMute">(real-money trades)</span></h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {windows.map((w) => {
          const d = pnl?.[w.key]
          const net = d?.houseNet ?? 0
          return (
            <div key={w.key} className="qx-card p-4">
              <div className="text-xs text-qx-textMute">{w.label}</div>
              {!pnl ? (
                <div className="mt-1 text-2xl font-extrabold text-qx-textDim">…</div>
              ) : (
                <>
                  <div className={`mt-1 text-2xl font-extrabold ${net >= 0 ? 'text-qx-green' : 'text-qx-red'}`}>
                    {net >= 0 ? '+' : '−'}${Math.abs(net).toLocaleString()}
                  </div>
                  <div className="mt-2 space-y-0.5 text-[11px] text-qx-textDim">
                    <div>Wagered: ${d.wagered.toLocaleString()}</div>
                    <div>{d.trades} trades · {d.userWinRate}% user win-rate</div>
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function RecentTable({ title, rows }) {
  return (
    <div className="qx-card overflow-hidden">
      <div className="border-b border-qx-border px-4 py-3 font-bold">{title}</div>
      {rows.length === 0 ? (
        <div className="p-4 text-sm text-qx-textMute">None yet.</div>
      ) : (
        <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-qx-border/50">
                <td className="px-4 py-2 text-qx-textDim">{r.email}</td>
                <td className="px-4 py-2">{r.method}</td>
                <td className="px-4 py-2 font-semibold text-white">${r.amount}</td>
                <td className="px-4 py-2">
                  <StatusBadge status={r.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  )
}

export function StatusBadge({ status }) {
  const m = {
    pending: 'bg-qx-gold/15 text-qx-gold',
    approved: 'bg-qx-green/15 text-qx-green',
    rejected: 'bg-qx-red/15 text-qx-red',
  }
  return (
    <span className={`rounded px-2 py-0.5 text-[11px] font-bold capitalize ${m[status] || ''}`}>
      {status}
    </span>
  )
}
