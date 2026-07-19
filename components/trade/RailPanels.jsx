'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/lib/store'
import AssetIcon from './AssetIcon'

// All left-rail slide-out panels (Help / More / Leader Board / Trading
// signals). The wrapper animates its width, so opening a panel pushes the
// chart layout to the right exactly like the real Quotex, on every screen
// size (the rail is always visible).
const PANEL_W = 'min(330px,calc(100vw - 68px))'

export default function RailPanels({ panel, setPanel, onAnalytics, onMarket }) {
  return (
    <div
      className="hidden shrink-0 overflow-hidden transition-[width] duration-300 ease-out md:block"
      style={{ width: panel ? PANEL_W : 0 }}
      aria-hidden={!panel}
    >
      <div
        className="flex h-full flex-col border-r border-qx-border bg-qx-panel"
        style={{ width: PANEL_W, minWidth: PANEL_W }}
      >
        {panel === 'help' && <HelpContent onClose={() => setPanel(null)} />}
        {panel === 'more' && (
          <MoreContent
            onClose={() => setPanel(null)}
            onOpen={setPanel}
            onAnalytics={onAnalytics}
            onMarket={onMarket}
          />
        )}
        {panel === 'top' && <LeaderBoardContent onBack={() => setPanel('more')} onClose={() => setPanel(null)} />}
        {panel === 'signals' && <SignalsContent onBack={() => setPanel('more')} onClose={() => setPanel(null)} />}
      </div>
    </div>
  )
}

export function PanelHeader({ title, sub, onBack, onClose, titleClass = 'text-white' }) {
  return (
    <div className="px-5 pb-2 pt-4">
      <div className="flex items-center gap-3">
        {onBack && (
          <button onClick={onBack} className="text-xl text-qx-textDim hover:text-white" aria-label="Back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
        <h2 className={`flex-1 text-xl font-bold ${titleClass}`}>{title}</h2>
        <button onClick={onClose} className="text-xl text-qx-textDim hover:text-white" aria-label="Close">✕</button>
      </div>
      {sub && <div className={`text-sm text-qx-textDim ${onBack ? 'pl-8' : ''}`}>{sub}</div>}
    </div>
  )
}

/* ------------------------------ Help ------------------------------ */

export function HelpContent({ onClose }) {
  return (
    <>
      <PanelHeader title="Help" onClose={onClose} />
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <HelpItem
          icon={
            <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor">
              <rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" />
              <rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" />
            </svg>
          }
          title="FAQ"
          sub="Open the database"
        />
        <div className="my-7 border-t border-qx-border" />
        <HelpItem
          icon={
            <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2 9l10-4 10 4-10 4z" /><path d="M6 11v4c0 1.1 2.7 2.5 6 2.5s6-1.4 6-2.5v-4" opacity="0.85" />
            </svg>
          }
          title="Tutorials"
          sub="Use the hints"
        />
        <div className="my-7 border-t border-qx-border" />
        <div className="pt-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-qx-red text-2xl font-bold text-white">?</div>
          <p className="text-base font-semibold text-white">Didn&apos;t find an answer to your question?</p>
          <button className="mt-1 text-base font-semibold text-[#5B9BFF] hover:underline">Contact support</button>
        </div>
      </div>
    </>
  )
}

function HelpItem({ icon, title, sub }) {
  return (
    <button className="block w-full text-center">
      <div className="mb-3 flex justify-center text-[#2F8FEE]">{icon}</div>
      <div className="text-xl font-bold text-white">{title}</div>
      <div className="mt-1 text-sm text-qx-textDim">{sub}</div>
    </button>
  )
}

/* ------------------------------ More ------------------------------ */

function MoreContent({ onClose, onOpen, onAnalytics, onMarket }) {
  const ITEMS = [
    {
      label: 'Analytics',
      onClick: onAnalytics,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2a10 10 0 1010 10h-10z" /><path d="M14 2.2V10h7.8A10 10 0 0014 2.2z" opacity="0.6" />
        </svg>
      ),
    },
    {
      label: 'TOP',
      onClick: () => onOpen('top'),
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      label: 'Signals',
      onClick: () => onOpen('signals'),
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="6" opacity="0.7" /><circle cx="12" cy="12" r="9.5" opacity="0.4" />
        </svg>
      ),
    },
    {
      label: 'Market',
      onClick: onMarket,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <ellipse cx="12" cy="6" rx="7" ry="3" />
          <path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" fill="none" stroke="currentColor" strokeWidth="2" />
          <text x="12" y="9" textAnchor="middle" fontSize="7" fill="#131A26" fontWeight="bold">$</text>
        </svg>
      ),
    },
  ]
  return (
    <>
      <PanelHeader title="More" onClose={onClose} />
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {ITEMS.map((it) => (
          <button
            key={it.label}
            onClick={it.onClick}
            className="flex w-full items-center gap-4 rounded-xl bg-qx-panel2 px-4 py-4 text-left transition hover:bg-qx-border"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white">{it.icon}</span>
            <span className="flex-1 text-[16px] font-bold text-white">{it.label}</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="text-qx-textDim">
              <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ))}
      </div>
    </>
  )
}

/* --------------------------- Leader Board --------------------------- */

export function LeaderBoardContent({ onBack, onClose }) {
  const me = useStore((s) => s.me)
  const history = useStore((s) => s.history)
  const [traders, setTraders] = useState([])
  const [board, setBoard] = useState(null) // { uid, profit, position } from the API
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let on = true
    const load = () =>
      fetch('/api/leaderboard')
        .then((r) => r.json())
        .then((d) => {
          if (!on) return
          setTraders(d.traders || [])
          setBoard(d.me || null)
        })
        .catch(() => {})
        .finally(() => on && setLoading(false))
    load()
    const id = setInterval(load, 20000)
    return () => {
      on = false
      clearInterval(id)
    }
  }, [])

  const accountId = me?.id ? String(parseInt(me.id.slice(0, 8), 16)).slice(0, 8) : '—'
  // your daily number: prefer the server's value, fall back to local history
  const today = new Date().toDateString()
  const localProfit = history
    .filter((t) => new Date(t.closeTime).toDateString() === today)
    .reduce((s, t) => s + (t.profit || 0), 0)
  const myProfit = board ? board.profit : localProfit
  const myPosition = board?.position ?? null

  return (
    <>
      <PanelHeader title="Leader Board" sub="of the Day" onBack={onBack} onClose={onClose} titleClass="text-[#F0D67E]" />
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {/* your position */}
        <div className="mt-2 rounded-xl bg-qx-panel2 p-3.5">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-qx-input text-base">🇵🇰</span>
            <span className="flex-1 truncate text-[15px] font-bold text-white">#{accountId}</span>
            <span className="text-[15px] font-bold text-qx-green">
              ${myProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="mt-2 text-sm font-semibold text-qx-textDim">
            Your position: <span className="text-white">{myPosition ?? '-'}</span>
          </div>
        </div>

        <button className="mt-3 flex w-full items-center gap-3 rounded-xl bg-[#15243C] px-4 py-3 text-left">
          <span className="text-lg">📊</span>
          <span className="text-[14px] font-bold text-[#5B9BFF]">How does this rating work?</span>
        </button>

        {loading ? (
          <div className="py-8 text-center text-sm text-qx-textMute">Loading…</div>
        ) : (
          <div className="mt-3">
            {traders.map((t, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 border-b border-qx-border/60 px-1 py-3 ${
                  board && t.uid === board.uid ? 'rounded-lg bg-qx-panel2' : ''
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    i === 0
                      ? 'bg-qx-gold text-black'
                      : i === 1
                      ? 'bg-[#C0C7D1] text-black'
                      : i === 2
                      ? 'bg-[#CD7F32] text-black'
                      : 'bg-transparent text-qx-textDim'
                  }`}
                >
                  {i + 1}
                </span>
                <span className="relative inline-flex h-8 w-11 shrink-0">
                  <span className="absolute left-0 flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-qx-input ring-2 ring-qx-panel">
                    {t.cc ? (
                      <img
                        src={`https://flagcdn.com/w40/${t.cc}.png`}
                        srcSet={`https://flagcdn.com/w80/${t.cc}.png 2x`}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7E8A99" strokeWidth="2">
                        <circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" />
                      </svg>
                    )}
                  </span>
                  <span className="absolute left-4 flex h-8 w-8 items-center justify-center rounded-full bg-qx-panel2 ring-2 ring-qx-panel">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7E8A99" strokeWidth="2">
                      <circle cx="12" cy="8" r="4" /><path d="M4 20a8 8 0 0116 0" strokeLinecap="round" />
                    </svg>
                  </span>
                </span>
                <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-white">
                  {t.anon ? `#${t.uid}` : t.name}
                </span>
                <span className="shrink-0 text-[14px] font-bold text-qx-green">
                  ${t.profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{t.plus ? '+' : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

/* --------------------------- Trading signals --------------------------- */

export function SignalsContent({ onBack, onClose }) {
  const [signals, setSignals] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let on = true
    const load = () =>
      fetch('/api/signals')
        .then((r) => r.json())
        .then((d) => on && setSignals(d.signals || []))
        .catch(() => {})
        .finally(() => on && setLoading(false))
    load()
    const id = setInterval(load, 60000)
    return () => {
      on = false
      clearInterval(id)
    }
  }, [])

  return (
    <>
      <PanelHeader title="Trading signals" onBack={onBack} onClose={onClose} />
      <div className="px-5 pb-1 text-right">
        <button className="text-xs font-bold tracking-wide text-[#5B9BFF] hover:underline">WHAT&apos;S IT?</button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {loading ? (
          <div className="py-8 text-center text-sm text-qx-textMute">Loading…</div>
        ) : (
          signals.map((s, i) => (
            <div key={i} className="border-b border-qx-border/60 px-1 py-3.5">
              <div className="flex items-center gap-3">
                <AssetIcon symbol={s.symbol || s.name} size={26} />
                <span className="min-w-0 flex-1 truncate text-[15px] font-bold text-white">{s.name || s.symbol}</span>
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-qx-panel2 ${
                    s.direction === 'up' ? 'text-qx-green' : 'text-qx-red'
                  }`}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                    {s.direction === 'up' ? (
                      <path d="M12 19V5M6 11l6-6 6 6" strokeLinecap="round" strokeLinejoin="round" />
                    ) : (
                      <path d="M12 5v14M6 13l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                    )}
                  </svg>
                </span>
              </div>
              <div className="mt-1.5 flex items-center justify-between pl-12 text-[13px] text-qx-textDim">
                <span>Duration: {s.duration}</span>
                <span>{s.time}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  )
}
