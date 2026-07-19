'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/lib/store'

function fmtTimeLeft(ms) {
  if (ms <= 0) return '0s'
  const s = Math.ceil(ms / 1000)
  const m = Math.floor(s / 60)
  const r = s % 60
  return m > 0 ? `${m}m ${r}s` : `${r}s`
}

export default function BottomTabs({ fill = false }) {
  const openTrades = useStore((s) => s.openTrades)
  const history = useStore((s) => s.history)
  const summary = useStore((s) => s.summary)
  const [tab, setTab] = useState('open') // 'open' | 'history'
  const [expanded, setExpanded] = useState(true)
  const [, force] = useState(0)

  // re-render every second for countdowns / live P&L
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])

  // opening the panel by switching a tab auto-expands it
  const selectTab = (id) => {
    setTab(id)
    setExpanded(true)
  }

  // Desktop ("fill"): the card fills the column from the top, its body scrolls,
  // and collapsing keeps the handle at the top. Mobile keeps the original
  // content-sized card with a fixed-height scroll body.
  return (
    <div
      className={`mx-2 mb-2 mt-1 flex min-h-0 flex-col overflow-hidden rounded-xl border border-qx-border border-t-2 border-t-[#2F8FEE] bg-qx-panel2/40 ${
        fill && expanded ? 'flex-1' : ''
      }`}
    >
      {/* header: Trades tab + history (clock) tab, each with a count badge */}
      <div className="flex shrink-0 items-center gap-2 px-3 pt-2">
        <TabBtn id="open" tab={tab} setTab={selectTab} count={openTrades.length}>
          Trades
        </TabBtn>
        <TabBtn id="history" tab={tab} setTab={selectTab} count={history.length}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </TabBtn>
      </div>

      {/* animated body */}
      <div
        className={`min-h-0 overflow-y-auto transition-[max-height,flex-grow,opacity] duration-300 ease-out ${
          fill
            ? expanded
              ? 'flex-1 opacity-100'
              : 'h-0 flex-none opacity-0'
            : expanded
            ? 'max-h-[34vh] opacity-100'
            : 'max-h-0 opacity-0'
        }`}
      >
        {tab === 'open' ? (
          <OpenTrades trades={openTrades} summary={summary} />
        ) : (
          <History trades={history} />
        )}
      </div>

      {/* sticky handle — always visible at the bottom; click to slide the panel
          up (expand) or down (collapse) */}
      <button
        onClick={() => setExpanded((e) => !e)}
        aria-label={expanded ? 'Collapse trades' : 'Expand trades'}
        className="flex w-full shrink-0 items-center justify-center gap-1.5 border-t border-qx-border/60 py-2 text-[11px] font-semibold uppercase tracking-wide text-qx-textDim transition hover:bg-qx-panel2/40 hover:text-white"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className={`transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
        >
          <path d="M6 15l6-6 6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {expanded ? 'Hide' : 'Show trades'}
      </button>
    </div>
  )
}

function TabBtn({ id, tab, setTab, count, children }) {
  const active = tab === id
  return (
    <button
      onClick={() => setTab(id)}
      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold transition ${
        active ? 'bg-qx-panel2 text-white' : 'text-qx-textDim hover:text-white'
      }`}
    >
      {children}
      <span
        className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
          count > 0 ? 'bg-qx-green text-white' : 'bg-qx-border text-qx-textDim'
        }`}
      >
        {count > 0 ? <span className="animate-pulseDot">{count}</span> : count}
      </span>
    </button>
  )
}

function OpenTrades({ trades, summary }) {
  if (!trades.length) return <Empty>No open trades. Place a trade to see it here.</Empty>
  return (
    <div className="divide-y divide-qx-border/40">
      {trades.map((t) => {
        const cur = summary[t.symbol]?.price ?? t.openPrice
        const inProfit = t.direction === 'up' ? cur > t.openPrice : cur < t.openPrice
        const pnl = inProfit ? t.amount * (t.payout / 100) : -t.amount
        const left = new Date(t.closeTime).getTime() - Date.now()
        return (
          <div key={t.id} className="flex items-center gap-2 px-3 py-2.5">
            <span className={`text-lg ${t.direction === 'up' ? 'text-qx-green' : 'text-qx-red'}`}>
              {t.direction === 'up' ? '▲' : '▼'}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-white">{t.symbol}</div>
              <div className="text-[11px] text-qx-textMute tabular-nums">
                ${t.amount} · {t.openPrice} → {cur}
              </div>
            </div>
            <div className="text-right">
              <div className={`text-sm font-bold tabular-nums ${inProfit ? 'text-qx-green' : 'text-qx-red'}`}>
                {inProfit ? '+' : ''}{pnl.toFixed(2)}$
              </div>
              <div className="text-[11px] font-semibold text-qx-gold tabular-nums">{fmtTimeLeft(left)}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function History({ trades }) {
  if (!trades.length) return <Empty>No trade history yet.</Empty>
  return (
    <div className="divide-y divide-qx-border/40">
      {trades.map((t) => {
        const won = t.status === 'won'
        return (
          <div key={t.id} className="flex items-center gap-2 px-3 py-2.5">
            <span className={`text-lg ${t.direction === 'up' ? 'text-qx-green' : 'text-qx-red'}`}>
              {t.direction === 'up' ? '▲' : '▼'}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-white">{t.symbol}</div>
              <div className="text-[11px] text-qx-textMute tabular-nums">
                ${t.amount} · {t.openPrice} → {t.closePrice ?? '—'} ·{' '}
                {new Date(t.closeTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            <div className="text-right">
              <div className={`text-sm font-bold tabular-nums ${won ? 'text-qx-green' : 'text-qx-red'}`}>
                {t.profit >= 0 ? '+' : ''}{Number(t.profit).toFixed(2)}$
              </div>
              <span className={`text-[10px] font-bold ${won ? 'text-qx-green' : 'text-qx-red'}`}>
                {won ? 'WIN' : 'LOSS'}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

const Empty = ({ children }) => (
  <div className="flex min-h-[150px] flex-col items-center justify-center gap-3 p-6 text-center text-sm text-qx-textMute">
    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-qx-panel2 text-qx-textDim">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" strokeLinecap="round" />
      </svg>
    </span>
    {children}
  </div>
)
