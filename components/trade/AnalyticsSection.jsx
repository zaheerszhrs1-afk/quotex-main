'use client'
import { useEffect, useMemo, useState } from 'react'
import { useStore } from '@/lib/store'
import AssetIcon from './AssetIcon'
import TournamentsPanel from './TournamentsPanel'
import Select from '@/components/ui/Select'

// Analytics / account area (replaces the chart area, like /en/analytics on the
// real site). All numbers come from the user's real closed-trade history in the
// DB. The top tabs switch the body — Analytics and Trades are implemented.
const TABS = ['Withdrawal', 'Transactions', 'Trades', 'My account', 'Market', 'Tournaments', 'Analytics']
const RANGES = { Today: 1, Week: 7, Month: 31 }

export default function AnalyticsSection({ onWithdraw, onDeposit, onMarket, initialTab = 'Analytics', onTabChange }) {
  const me = useStore((s) => s.me)
  const balance = useStore((s) => s.balance)
  const history = useStore((s) => s.history)
  const [range, setRange] = useState('Month')
  const [hidden, setHidden] = useState(false)
  const [tab, setTab] = useState(initialTab)

  // follow external section changes (rail / nav clicks) without remounting
  useEffect(() => { setTab(initialTab) }, [initialTab])

  const onTab = (t) => {
    if (t === 'Market') return onMarket?.() // open the asset picker (like More → Market)
    setTab(t)
    onTabChange?.(t) // lift selection so it persists across refresh
  }

  const accountId = me?.id ? String(parseInt(me.id.slice(0, 8), 16)).slice(0, 8) : '—'
  const fmt = (n) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const mask = (s) => (hidden ? '$ •••••' : s)

  const stats = useMemo(() => {
    const since = Date.now() - RANGES[range] * 24 * 60 * 60 * 1000
    const trades = history.filter((t) => new Date(t.closeTime).getTime() >= since)
    const wins = trades.filter((t) => t.status === 'won')
    const profit = trades.reduce((s, t) => s + (t.profit || 0) - (t.status === 'lost' ? t.amount : 0), 0)
    const turnover = trades.reduce((s, t) => s + (t.amount || 0), 0)

    // daily profit series for the chart
    const days = RANGES[range]
    const buckets = new Array(days).fill(0)
    for (const t of trades) {
      const d = Math.floor((Date.now() - new Date(t.closeTime).getTime()) / (24 * 60 * 60 * 1000))
      const idx = days - 1 - Math.min(days - 1, d)
      buckets[idx] += (t.profit || 0) - (t.status === 'lost' ? t.amount : 0)
    }
    return {
      count: trades.length,
      profit,
      wins: wins.length,
      winPct: trades.length ? Math.round((wins.length / trades.length) * 100) : 0,
      avg: trades.length ? profit / trades.length : 0,
      turnover,
      buckets,
    }
  }, [history, range])

  return (
    <div className="h-full overflow-y-auto bg-qx-bg px-3 py-3 md:px-5">
      {/* mobile: section dropdown */}
      <div className="relative z-30 md:hidden">
        <Select value={tab} onChange={onTab} options={TABS} size="lg" />
      </div>

      {/* desktop: section tabs */}
      <div className="hidden items-center gap-1 overflow-x-auto rounded-xl bg-qx-panel px-2 py-2 md:flex">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => onTab(t)}
            className={`shrink-0 rounded-lg px-4 py-2 text-[14px] font-bold transition ${
              t === tab
                ? 'border border-qx-border bg-qx-panel2 text-white'
                : 'text-qx-textDim hover:text-white'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Withdrawal' ? (
        <WithdrawalPanel onDeposit={onDeposit} />
      ) : tab === 'Trades' ? (
        <TradesPanel />
      ) : tab === 'My account' ? (
        <MyAccountPanel />
      ) : tab === 'Transactions' ? (
        <TransactionsPanel />
      ) : tab === 'Tournaments' ? (
        <TournamentsPanel onDeposit={onDeposit} />
      ) : tab !== 'Analytics' ? (
        <ComingSoon name={tab} />
      ) : (
      <>
      {/* profile strip — stacked on mobile, single row on desktop */}
      <div className="mt-3 rounded-xl bg-qx-panel px-4 py-4 md:flex md:flex-wrap md:items-center md:gap-x-6 md:gap-y-3 md:py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-qx-panel2">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2F8FEE" strokeWidth="2">
              <circle cx="12" cy="8" r="4" /><path d="M4 20a8 8 0 0116 0" strokeLinecap="round" />
            </svg>
          </span>
          <div className="min-w-0 flex-1 leading-tight md:flex-none">
            <div className="truncate text-sm text-qx-textDim">{me?.email}</div>
            <div className="flex items-center gap-1.5 text-[15px] font-bold text-white">
              ID: {accountId}
              <svg width="15" height="15" viewBox="0 0 24 24" fill="#00C076"><path d="M2 21l21-9L2 3v7l15 2-15 2z" /></svg>
            </div>
          </div>
          <button
            onClick={() => setHidden((h) => !h)}
            className="flex h-11 w-12 shrink-0 items-center justify-center rounded-lg bg-qx-panel2 text-white hover:text-qx-textDim md:hidden"
            title="Hide balances"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="2.6" />
            </svg>
          </button>
        </div>
        <div className="mt-6 md:mt-0"><Cell label="Location" value={me?.country || '—'} /></div>
        <div className="mt-6 md:mt-0"><Cell label="In the account" value={mask(fmt(balance.realBalance))} /></div>
        <div className="mt-2 md:mt-0"><Cell label="In the demo" value={mask(fmt(balance.demoBalance))} /></div>
        <button
          onClick={() => setHidden((h) => !h)}
          className="hidden h-10 w-12 items-center justify-center rounded-lg bg-qx-panel2 text-white hover:text-qx-textDim md:flex"
          title="Hide balances"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="2.6" />
          </svg>
        </button>
        <div className="hidden md:ml-auto md:block md:w-32">
          <Select value={range} onChange={setRange} options={Object.keys(RANGES)} size="md" align="right" className="border border-qx-border" />
        </div>
      </div>

      {/* mobile: Month selector as its own card */}
      <div className="mt-3 md:hidden">
        <Select value={range} onChange={setRange} options={Object.keys(RANGES)} size="lg" />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {/* general data */}
        <div className="rounded-xl bg-qx-panel">
          <div className="border-b border-qx-border px-5 py-4 text-[16px] font-bold text-white">General data</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-7 px-5 py-6 sm:grid-cols-3">
            <Stat ring value={stats.count} label="Trades count" />
            <Stat value={`${stats.profit.toFixed(0)} $`} label="Trades profit" />
            <Stat ring value={stats.wins} sub={`${stats.winPct}%`} label="Profitable trades" />
            <Stat value={`${stats.avg.toFixed(0)} $`} label="Average profit" />
            <Stat value={`${stats.turnover.toFixed(0)} $`} label="Net turnover" />
            <Stat value="0 $" label="Hedged trades" />
          </div>
        </div>

        {/* profit chart */}
        <div className="rounded-xl bg-qx-panel">
          <div className="border-b border-qx-border px-5 py-4 text-[16px] font-bold text-white">
            Statistics of profitable trades
          </div>
          <div className="px-5 py-6">
            <ProfitChart buckets={stats.buckets} />
          </div>
        </div>
      </div>
      </>
      )}
    </div>
  )
}

function Cell({ label, value }) {
  return (
    <div className="leading-tight">
      <div className="text-sm text-qx-textDim">{label}</div>
      <div className="text-[15px] font-bold text-white">{value}</div>
    </div>
  )
}

function Stat({ value, label, sub, ring }) {
  return (
    <div>
      {ring ? (
        <div className="relative inline-flex h-16 w-16 items-center justify-center rounded-full border-2 border-qx-panel2">
          <span className="text-lg font-bold text-white">{value}</span>
          {sub && <span className="absolute -bottom-1 right-0 rounded bg-qx-panel px-0.5 text-[11px] font-bold text-qx-textDim">{sub}</span>}
        </div>
      ) : (
        <div>
          <div className="text-xl font-bold text-white">{value}</div>
          <div className="mt-1.5 flex gap-1">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="h-2 w-7 rounded-sm bg-qx-panel2" />
            ))}
          </div>
        </div>
      )}
      <div className="mt-2 text-sm text-qx-textDim">{label}</div>
    </div>
  )
}

function ProfitChart({ buckets }) {
  const W = 560
  const H = 240
  const PAD = 28
  const max = Math.max(1, ...buckets.map((v) => Math.abs(v)))
  const stepX = (W - PAD * 2) / Math.max(1, buckets.length - 1)
  const y = (v) => H / 2 - (v / max) * (H / 2 - PAD)
  const points = buckets.map((v, i) => `${PAD + i * stepX},${y(v)}`).join(' ')

  // a few date labels along the x axis
  const labels = []
  const n = buckets.length
  for (let i = 0; i < 4; i++) {
    const idx = Math.round((i / 3) * (n - 1))
    const d = new Date(Date.now() - (n - 1 - idx) * 24 * 60 * 60 * 1000)
    labels.push({ x: PAD + idx * stepX, text: `${d.getDate()}. ${d.toLocaleString('en', { month: 'short' })}` })
  }

  return (
    <svg viewBox={`0 0 ${W} ${H + 24}`} className="w-full">
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1={PAD} x2={W - PAD} y1={H * f} y2={H * f} stroke="rgba(255,255,255,0.06)" />
      ))}
      <text x={PAD - 8} y={H / 2 + 4} fill="#566273" fontSize="11" textAnchor="end">0</text>
      <polyline points={points} fill="none" stroke="#00C076" strokeWidth="2" strokeLinejoin="round" />
      {labels.map((l) => (
        <text key={l.x} x={l.x} y={H + 16} fill="#566273" fontSize="11" textAnchor="middle">
          {l.text}
        </text>
      ))}
    </svg>
  )
}

/* -------------------------------- Trades -------------------------------- */
// Real DB-backed trade history / pending trades, like the /trades page on the
// real site. Fetches the current user's trades and filters by account + date.

const toInput = (d) => new Date(d).toISOString().slice(0, 10) // YYYY-MM-DD
const fmtDate = (d) =>
  new Date(d).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

function TradesPanel() {
  const [sub, setSub] = useState('history') // 'history' | 'pending'
  const [acct, setAcct] = useState('real') // 'real' (Live) | 'demo'
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const yearAgo = useMemo(() => Date.now() - 365 * 24 * 60 * 60 * 1000, [])
  const [from, setFrom] = useState(toInput(yearAgo))
  const [to, setTo] = useState(toInput(Date.now()))

  useEffect(() => {
    let on = true
    setLoading(true)
    const status = sub === 'history' ? 'closed' : 'open'
    fetch(`/api/trades?status=${status}`)
      .then((r) => r.json())
      .then((d) => on && setRows(Array.isArray(d.trades) ? d.trades : []))
      .catch(() => on && setRows([]))
      .finally(() => on && setLoading(false))
    return () => {
      on = false
    }
  }, [sub])

  const fromMs = new Date(from).getTime()
  const toMs = new Date(to).getTime() + 24 * 60 * 60 * 1000 // inclusive end-of-day
  const filtered = rows.filter((t) => {
    if ((t.accountType || 'demo') !== acct) return false
    const ts = new Date(sub === 'history' ? t.closeTime || t.openTime : t.openTime).getTime()
    return ts >= fromMs && ts <= toMs
  })

  return (
    <div className="mt-3">
      {/* sub-tabs */}
      <div className="flex gap-6 border-b border-qx-border">
        {[
          ['history', 'Trade history'],
          ['pending', 'Pending trades'],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setSub(id)}
            className={`-mb-px whitespace-nowrap border-b-2 pb-3 pt-1 text-[15px] font-bold transition ${
              sub === id ? 'border-[#2F8FEE] text-white' : 'border-transparent text-qx-textDim hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* filters */}
      <div className="mt-5 flex flex-wrap gap-4">
        <Field label="Date Range:">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7E8A99" strokeWidth="2">
            <rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" strokeLinecap="round" />
          </svg>
          <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="bg-transparent text-sm text-white outline-none [color-scheme:dark]" />
          <span className="text-qx-textDim">-</span>
          <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="bg-transparent text-sm text-white outline-none [color-scheme:dark]" />
        </Field>
        <Field label="Account Type:">
          <Select
            variant="bare"
            value={acct}
            onChange={setAcct}
            options={[{ value: 'real', label: 'Live Account' }, { value: 'demo', label: 'Demo Account' }]}
            className="text-sm font-semibold"
          />
        </Field>
      </div>

      {/* table / empty */}
      {loading ? (
        <div className="py-20 text-center text-sm text-qx-textMute">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="text-lg font-bold text-white">No data to display</div>
          <div className="mt-1 text-sm text-qx-textMute">
            {sub === 'history' ? "You don't have a trade history yet." : "You don't have any pending trades."}
          </div>
        </div>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-xl border border-qx-border">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-qx-border text-xs font-semibold uppercase tracking-wide text-qx-textMute">
                <th className="px-4 py-3 font-semibold">Asset</th>
                <th className="px-4 py-3 font-semibold">{sub === 'history' ? 'Closed' : 'Opened'}</th>
                <th className="px-4 py-3 text-right font-semibold">Investment</th>
                <th className="px-4 py-3 text-center font-semibold">Direction</th>
                <th className="px-4 py-3 text-right font-semibold">{sub === 'history' ? 'Result' : 'Payout'}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const won = t.status === 'won'
                const profit = Number(t.profit || 0)
                return (
                  <tr key={t.id} className="border-b border-qx-border/40 last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <AssetIcon symbol={t.symbol} size={22} />
                        <span className="font-semibold text-white">{t.symbol}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-qx-textDim tabular-nums">
                      {fmtDate(sub === 'history' ? t.closeTime || t.openTime : t.openTime)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-white tabular-nums">${Number(t.amount).toFixed(2)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-base ${t.direction === 'up' ? 'text-qx-green' : 'text-qx-red'}`}>
                        {t.direction === 'up' ? '▲' : '▼'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums">
                      {sub === 'history' ? (
                        <span className={won ? 'text-qx-green' : 'text-qx-red'}>
                          {profit >= 0 ? '+' : ''}
                          {profit.toFixed(2)}$
                        </span>
                      ) : (
                        <span className="text-qx-gold">{t.payout}%</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className="relative rounded-lg border border-qx-border bg-qx-panel">
      <span className="absolute -top-2 left-3 bg-qx-bg px-1 text-[11px] text-qx-textDim">{label}</span>
      <div className="flex items-center gap-2 px-3 py-2.5">{children}</div>
    </div>
  )
}

function ComingSoon({ name }) {
  return (
    <div className="flex flex-col items-center justify-center py-28 text-center">
      <div className="text-lg font-bold text-white">{name}</div>
      <div className="mt-1 text-sm text-qx-textMute">This section is coming soon.</div>
    </div>
  )
}

/* ----------------------------- Transactions ----------------------------- */
// Real DB-backed deposits + withdrawals with their statuses (pending / approved
// / rejected). Empty -> "No data to display".

function StatusBadge({ status }) {
  const map = {
    pending: 'bg-qx-gold/15 text-qx-gold',
    approved: 'bg-qx-green/15 text-qx-green',
    rejected: 'bg-qx-red/15 text-qx-red',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold capitalize ${map[status] || 'bg-qx-panel2 text-qx-textDim'}`}>
      {status}
    </span>
  )
}

function TransactionsPanel() {
  const [filter, setFilter] = useState('all') // 'all' | 'deposit' | 'withdraw'
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let on = true
    setLoading(true)
    Promise.all([
      fetch('/api/deposits').then((r) => r.json()).catch(() => ({})),
      fetch('/api/withdrawals').then((r) => r.json()).catch(() => ({})),
    ])
      .then(([dep, wd]) => {
        if (!on) return
        const deposits = (dep.deposits || []).map((d) => ({ ...d, kind: 'deposit' }))
        const withdrawals = (wd.withdrawals || []).map((w) => ({ ...w, kind: 'withdraw' }))
        const all = [...deposits, ...withdrawals].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        setRows(all)
      })
      .finally(() => on && setLoading(false))
    return () => {
      on = false
    }
  }, [])

  const filtered = rows.filter((t) => (filter === 'all' ? true : t.kind === filter))

  const tabs = [
    ['all', 'All'],
    ['deposit', 'Deposits'],
    ['withdraw', 'Withdrawals'],
  ]

  return (
    <div className="mt-3">
      {/* sub-tabs */}
      <div className="flex gap-6 border-b border-qx-border">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            className={`-mb-px whitespace-nowrap border-b-2 pb-3 pt-1 text-[15px] font-bold transition ${
              filter === id ? 'border-[#2F8FEE] text-white' : 'border-transparent text-qx-textDim hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-20 text-center text-sm text-qx-textMute">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="text-lg font-bold text-white">No data to display</div>
          <div className="mt-1 text-sm text-qx-textMute">You don&apos;t have any transactions yet.</div>
        </div>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-xl border border-qx-border">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-qx-border text-xs font-semibold uppercase tracking-wide text-qx-textMute">
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Method</th>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 text-right font-semibold">Amount</th>
                <th className="px-4 py-3 text-right font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const isDep = t.kind === 'deposit'
                return (
                  <tr key={`${t.kind}-${t.id}`} className="border-b border-qx-border/40 last:border-0">
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2 font-semibold text-white">
                        <span className={`flex h-6 w-6 items-center justify-center rounded-full ${isDep ? 'bg-qx-green/15 text-qx-green' : 'bg-qx-red/15 text-qx-red'}`}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            {isDep ? (
                              <path d="M12 5v14M6 13l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                            ) : (
                              <path d="M12 19V5M6 11l6-6 6 6" strokeLinecap="round" strokeLinejoin="round" />
                            )}
                          </svg>
                        </span>
                        {isDep ? 'Deposit' : 'Withdrawal'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-qx-textDim">{t.method}</td>
                    <td className="px-4 py-3 text-qx-textDim tabular-nums">{fmtDate(t.createdAt)}</td>
                    <td className={`px-4 py-3 text-right font-bold tabular-nums ${isDep ? 'text-qx-green' : 'text-qx-red'}`}>
                      {isDep ? '+' : '-'}${Number(t.amount).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <StatusBadge status={t.status} />
                      {t.status === 'rejected' && t.adminNote && (
                        <div className="mt-1 max-w-[180px] text-xs text-qx-red">
                          {t.adminNote}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ------------------------------ Withdrawal ------------------------------ */
// Full-page withdrawal screen (like the real Quotex "Withdrawal" tab). Shows
// the account balances; when funds are available it renders the request form
// (pick a method you deposited with — JazzCash / EasyPaisa / etc.), otherwise
// the "make a deposit first" notice. Lists the latest withdrawal requests.

const WITHDRAW_FAQ = [
  { q: 'How to withdraw money from the account?', a: 'Open the Withdrawal tab, choose the method you used for depositing, enter the amount and your account details, then submit the request.' },
  { q: 'What is account verification?', a: 'Verification confirms your identity to keep your funds secure. You may be asked for it before large withdrawals.' },
  { q: 'How long does it take to withdraw funds?', a: 'Withdrawal requests are reviewed and processed within 3 business days.' },
  { q: 'How to understand that I need to go through account verification?', a: 'If verification is required you will be notified by email and inside the platform.' },
]

function WithdrawalPanel({ onDeposit }) {
  const balance = useStore((s) => s.balance)
  const setBalance = useStore((s) => s.setBalance)
  const pushToast = useStore((s) => s.pushToast)

  const [settings, setSettings] = useState({ minWithdrawal: 200, methods: [] })
  const [rows, setRows] = useState([])
  const [openFaq, setOpenFaq] = useState(null)

  const [amount, setAmount] = useState(200)
  const [method, setMethod] = useState('JazzCash')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)

  const available = balance.realBalance
  const fmt = (n) => `${Number(n).toFixed(2)} $`

  useEffect(() => {
    fetch('/api/payment-settings')
      .then((r) => r.json())
      .then((d) => {
        setSettings(d)
        setAmount(d.minWithdrawal || 200)
        if (d.methods?.length) setMethod(d.methods[0].name)
      })
      .catch(() => {})
  }, [])

  const loadRequests = () =>
    fetch('/api/withdrawals')
      .then((r) => r.json())
      .then((d) => setRows(d.withdrawals || []))
      .catch(() => {})
  useEffect(() => { loadRequests() }, [])

  const methodNames = settings.methods?.length ? settings.methods.map((m) => m.name) : ['JazzCash', 'EasyPaisa', 'Bank Transfer', 'USDT (TRC-20)']

  async function submit() {
    if (amount < (settings.minWithdrawal || 0)) {
      pushToast({ type: 'loss', title: 'Amount too low', msg: `Minimum withdrawal is ${settings.minWithdrawal}.` })
      return
    }
    if (amount > available) {
      pushToast({ type: 'loss', title: 'Insufficient balance', msg: `Available for withdrawal: ${fmt(available)}.` })
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, method, recipientDetails: details }),
      })
      const data = await res.json()
      if (!res.ok) {
        pushToast({ type: 'loss', title: 'Withdrawal failed', msg: data.error })
      } else {
        if (data.realBalance != null) setBalance({ ...balance, realBalance: data.realBalance })
        setDetails('')
        loadRequests()
        pushToast({ type: 'win', title: 'Request submitted', msg: 'Awaiting admin payout.' })
      }
    } catch {
      pushToast({ type: 'loss', title: 'Network error', msg: 'Try again.' })
    }
    setBusy(false)
  }

  return (
    <div className="mt-3 pb-10">
      <div className="grid gap-8 md:grid-cols-2">
        {/* left — account balances */}
        <div>
          <h2 className="text-xl font-bold text-white">Account:</h2>
          <div className="mt-6 border-b border-qx-border pb-6">
            <div className="text-sm text-qx-textDim">In the account:</div>
            <div className="mt-1 text-3xl font-bold text-white">{fmt(balance.realBalance)}</div>
          </div>
          <div className="mt-6">
            <div className="text-sm text-qx-textDim">Available for withdrawal:</div>
            <div className="mt-1 text-3xl font-bold text-white">{fmt(available)}</div>
          </div>
        </div>

        {/* right — withdrawal form / notice */}
        <div className="md:border-l md:border-qx-border md:pl-8">
          <h2 className="text-xl font-bold text-white">Withdrawal:</h2>
          {available <= 0 ? (
            <div className="mt-5 rounded-lg border border-qx-red/60 bg-qx-red/5 p-5">
              <div className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-qx-red text-sm font-bold text-white">!</span>
                <p className="text-[15px] leading-relaxed text-white">
                  You can withdraw money from your balance to your bank card or electronic purse you used for depositing.
                  You can request withdrawal any time. Your withdrawal requests are processed in 3 business days.
                </p>
              </div>
              <button onClick={onDeposit} className="mt-3 pl-10 text-[15px] font-bold text-qx-green hover:underline">
                Make a deposit
              </button>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              <FormField label="Method">
                <Select
                  variant="bare"
                  value={method}
                  onChange={setMethod}
                  options={methodNames}
                  className="text-sm font-semibold"
                />
              </FormField>
              <FormField label={`Amount (min ${settings.minWithdrawal})`}>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full bg-transparent text-[15px] text-white outline-none"
                />
              </FormField>
              <FormField label="Your account / wallet">
                <input
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Number or wallet address"
                  className="w-full bg-transparent text-[15px] text-white outline-none placeholder:text-qx-textMute"
                />
              </FormField>
              <button
                onClick={submit}
                disabled={busy}
                className="w-full rounded-lg bg-qx-green py-3.5 text-[15px] font-bold text-white transition hover:bg-qx-greenHover disabled:opacity-60"
              >
                {busy ? 'Submitting…' : 'Request withdrawal'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* latest requests */}
      <div className="mt-10 border-t border-qx-border pt-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Some of your latest requests:</h3>
        </div>
        {rows.length === 0 ? (
          <p className="mt-4 text-sm text-qx-textMute">You don&apos;t have any withdrawal requests yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-qx-border">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-qx-border text-xs font-semibold uppercase tracking-wide text-qx-textMute">
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((w) => (
                  <tr key={w.id} className="border-b border-qx-border/40 last:border-0">
                    <td className="px-4 py-3 text-white">{w.method}</td>
                    <td className="px-4 py-3 text-qx-textDim tabular-nums">{fmtDate(w.createdAt)}</td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums text-qx-red">-${Number(w.amount).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">
                      <StatusBadge status={w.status} />
                      {w.status === 'rejected' && w.adminNote && (
                        <div className="mt-1 max-w-[180px] text-xs text-qx-red">
                          {w.adminNote}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* FAQ */}
      <div className="mt-10 border-t border-qx-border pt-6">
        <h3 className="text-lg font-bold text-white">FAQ:</h3>
        <div className="mt-4 grid gap-x-10 gap-y-1 md:grid-cols-2">
          {WITHDRAW_FAQ.map((f, i) => (
            <div key={i} className="border-b border-qx-border/60">
              <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="flex w-full items-center gap-2 py-3 text-left">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
                  className={`text-qx-textDim transition-transform ${openFaq === i ? 'rotate-180' : ''}`}>
                  <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-[15px] font-bold text-white">{f.q}</span>
              </button>
              {openFaq === i && <p className="pb-3 pl-6 text-sm leading-relaxed text-qx-textDim">{f.a}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------ My account ------------------------------ */
// Editable profile saved to the real DB. Document/KYC verification is
// intentionally skipped per product decision.

const COUNTRIES = [
  'Pakistan', 'India', 'Bangladesh', 'United Arab Emirates', 'Saudi Arabia',
  'United Kingdom', 'United States', 'Germany', 'France', 'Spain', 'Italy',
  'Turkey', 'Egypt', 'Nigeria', 'South Africa', 'Brazil', 'Mexico',
  'Indonesia', 'Malaysia', 'Philippines', 'Vietnam', 'Thailand', 'Japan',
  'South Korea', 'Australia', 'Canada', 'Russia', 'China',
]

function MyAccountPanel() {
  const me = useStore((s) => s.me)
  const setMe = useStore((s) => s.setMe)
  const pushToast = useStore((s) => s.pushToast)

  const [form, setForm] = useState({ firstName: '', lastName: '', dob: '', country: '', address: '' })
  const [saving, setSaving] = useState(false)
  const [twoStepEnter, setTwoStepEnter] = useState(true)
  const [twoStepWithdraw, setTwoStepWithdraw] = useState(true)
  const [language, setLanguage] = useState('English')
  const [timezone, setTimezone] = useState('(UTC+00:00)')

  useEffect(() => {
    if (me) {
      setForm({
        firstName: me.firstName || '',
        lastName: me.lastName || '',
        dob: me.dob || '',
        country: me.country || '',
        address: me.address || '',
      })
    }
  }, [me])

  const id = me?.id ? String(parseInt(me.id.slice(0, 8), 16)).slice(0, 8) : '—'
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Save failed')
      setMe(d.user)
      pushToast?.({ type: 'info', title: 'Saved', msg: 'Your profile has been updated.' })
    } catch (e) {
      pushToast?.({ type: 'loss', title: 'Save failed', msg: e.message })
    } finally {
      setSaving(false)
    }
  }

  const input = 'w-full bg-transparent text-[15px] text-white outline-none placeholder:text-qx-textMute'

  return (
    <div className="mt-4 grid gap-x-12 gap-y-10 lg:grid-cols-2">
      {/* left — personal data */}
      <div>
        <h3 className="text-lg font-bold text-white">Personal data:</h3>
        <div className="mt-5 flex items-center gap-3">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-qx-panel2">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#2F8FEE" strokeWidth="2">
              <circle cx="12" cy="8" r="4" /><path d="M4 20a8 8 0 0116 0" strokeLinecap="round" />
            </svg>
          </span>
          <div className="min-w-0">
            <div className="truncate text-[15px] font-bold text-white">{me?.email}</div>
            <div className="text-sm text-qx-textDim">ID: {id}</div>
          </div>
        </div>

        <div className="mt-6 space-y-5">
          <FormField label="Nickname">
            <div className={input}>#{id}</div>
          </FormField>
          <FormField label="First Name">
            <input value={form.firstName} onChange={(e) => set('firstName', e.target.value)} placeholder="Empty" className={input} />
          </FormField>
          <FormField label="Last Name">
            <input value={form.lastName} onChange={(e) => set('lastName', e.target.value)} placeholder="Empty" className={input} />
          </FormField>
          <FormField label="Date of birth">
            <input type="date" value={form.dob} onChange={(e) => set('dob', e.target.value)} className={`${input} [color-scheme:dark]`} />
          </FormField>
          <FormField label="Country">
            <Select
              variant="bare"
              value={form.country}
              onChange={(v) => set('country', v)}
              options={[{ value: '', label: 'Empty' }, ...COUNTRIES]}
            />
          </FormField>
          <FormField label="Address">
            <input value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Empty" className={input} />
          </FormField>
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="mt-6 w-full rounded-lg bg-[#2F8FEE] py-3.5 text-[15px] font-bold text-white transition hover:brightness-110 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {/* right — security + settings */}
      <div className="space-y-8">
        <div>
          <h3 className="text-lg font-bold text-white">Security:</h3>
          <div className="mt-5 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-qx-green">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><path d="M5 12l4 4 10-10" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
            <span className="text-[15px] font-bold text-white">Two-step verification</span>
          </div>
          <div className="mt-1 pl-7 text-sm text-qx-textDim">Receiving codes via Email</div>

          <div className="mt-5 space-y-4 pl-1">
            <ToggleRow label="To enter the platform" on={twoStepEnter} onToggle={() => setTwoStepEnter((v) => !v)} />
            <ToggleRow label="To withdraw funds" on={twoStepWithdraw} onToggle={() => setTwoStepWithdraw((v) => !v)} />
          </div>

          <div className="mt-7 flex items-start gap-3 border-t border-qx-border pt-6">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7E8A99" strokeWidth="2"><rect x="4" y="11" width="16" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" strokeLinecap="round" /></svg>
            <div>
              <div className="text-[15px] font-bold text-white">Password</div>
              <div className="text-sm text-qx-textDim">Change your account password</div>
              <button
                onClick={() => pushToast?.({ type: 'info', title: 'Password', msg: 'Password change is coming soon.' })}
                className="mt-1 text-sm font-bold text-[#5B9BFF] hover:underline"
              >
                Change
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <FormField label="Language">
            <Select
              variant="bare"
              value={language}
              onChange={setLanguage}
              options={['English', 'العربية', 'हिन्दी', 'Español', 'Português']}
            />
          </FormField>
          <FormField label="Timezone">
            <Select
              variant="bare"
              value={timezone}
              onChange={setTimezone}
              options={['(UTC+00:00)', '(UTC+01:00)', '(UTC+03:00)', '(UTC+04:00)', '(UTC+05:00)', '(UTC+05:30)', '(UTC+08:00)']}
            />
          </FormField>
        </div>

        <button
          onClick={() => pushToast?.({ type: 'loss', title: 'Delete account', msg: 'Account deletion is not available in this demo.' })}
          className="flex items-center gap-2 text-[15px] font-bold text-qx-red hover:underline"
        >
          ✕ Delete My account
        </button>
      </div>
    </div>
  )
}

function FormField({ label, children }) {
  return (
    <div className="relative rounded-lg border border-qx-border bg-qx-panel px-4 pb-2.5 pt-4">
      <span className="absolute -top-2 left-3 bg-qx-bg px-1 text-[11px] text-qx-textDim">{label}</span>
      {children}
    </div>
  )
}

function ToggleRow({ label, on, onToggle }) {
  return (
    <button onClick={onToggle} className="flex w-full items-center gap-3 text-left">
      <span className={`relative h-5 w-9 shrink-0 rounded-full transition ${on ? 'bg-[#2F8FEE]' : 'bg-qx-panel2'}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
      <span className="text-[15px] font-bold text-white">{label}</span>
    </button>
  )
}
