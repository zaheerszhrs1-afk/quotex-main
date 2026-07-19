'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useStore } from '@/lib/store'
import { getSocket, disconnectSocket } from '@/lib/socketClient'
import { fetchMe } from '@/lib/authClient'
import TradeHeader from './TradeHeader'
import LeftRail from './LeftRail'
import RailPanels from './RailPanels'
import MobileSheets from './MobileSheets'
import AnalyticsSection from './AnalyticsSection'
import AssetTabs from './AssetTabs'
import AssetPickerModal from './AssetPickerModal'
import CandlestickChart from '@/components/chart/CandlestickChart'
import BottomTabs from './BottomTabs'
import TradePanel from './TradePanel'
import Toasts from '@/components/ui/Toasts'
import PaymentModal from './PaymentModal'

// Persist the open UI state (current view, section, rail/mobile panels and any
// open modal) so a page refresh drops the user back exactly where they were.
const UI_KEY = 'qx:tradeUI'
const MARKET_KEY = 'qx:market' // open tabs + active symbol + timeframe
function loadJSON(key) {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(key) || '{}') || {}
  } catch {
    return {}
  }
}
const loadTradeUI = () => loadJSON(UI_KEY)

export default function TradeShell() {
  const router = useRouter()
  const setMe = useStore((s) => s.setMe)
  const setAssets = useStore((s) => s.setAssets)
  const openSymbolTab = useStore((s) => s.openSymbol)
  const setOpenSymbols = useStore((s) => s.setOpenSymbols)
  const setTimeframe = useStore((s) => s.setTimeframe)
  const openSymbols = useStore((s) => s.openSymbols)
  const activeSymbol = useStore((s) => s.activeSymbol)
  const timeframe = useStore((s) => s.timeframe)
  const setSummary = useStore((s) => s.setSummary)
  const setBalance = useStore((s) => s.setBalance)
  const setOpenTrades = useStore((s) => s.setOpenTrades)
  const setHistory = useStore((s) => s.setHistory)
  const resolveOpenTrade = useStore((s) => s.resolveOpenTrade)
  const pushToast = useStore((s) => s.pushToast)
  const triggerFlash = useStore((s) => s.triggerFlash)
  const setAnnouncement = useStore((s) => s.setAnnouncement)
  const announcement = useStore((s) => s.announcement)
  const setTradingView = useStore((s) => s.setTradingView)

  const [restored] = useState(loadTradeUI) // read persisted UI state once (client-only)
  const [paymentOpen, setPaymentOpen] = useState(!!restored.paymentOpen)
  const [paymentTab, setPaymentTab] = useState(restored.paymentTab || 'deposit')
  const [pickerOpen, setPickerOpen] = useState(!!restored.pickerOpen)
  const [railPanel, setRailPanel] = useState(restored.railPanel ?? null) // 'help' | 'more' | 'top' | 'signals' | null
  const [view, setView] = useState(restored.view || 'trade') // 'trade' | 'analytics'
  const [analyticsTab, setAnalyticsTab] = useState(restored.analyticsTab || 'Analytics') // section tab when view==='analytics'
  const [accountMenuOpen, setAccountMenuOpen] = useState(false) // header account dropdown (transient, not persisted)
  const [mobilePanel, setMobilePanel] = useState(restored.mobilePanel ?? null) // 'trade' | 'history' | null

  // save the open UI state on every change so it survives a refresh
  useEffect(() => {
    try {
      localStorage.setItem(
        UI_KEY,
        JSON.stringify({ view, analyticsTab, railPanel, paymentOpen, paymentTab, pickerOpen, mobilePanel })
      )
    } catch {}
  }, [view, analyticsTab, railPanel, paymentOpen, paymentTab, pickerOpen, mobilePanel])

  // save the open asset tabs / active symbol / timeframe (skip the empty initial
  // state so it doesn't clobber what we're about to restore)
  useEffect(() => {
    if (!openSymbols.length) return
    try {
      localStorage.setItem(MARKET_KEY, JSON.stringify({ openSymbols, activeSymbol, timeframe }))
    } catch {}
  }, [openSymbols, activeSymbol, timeframe])

  // --- browser back/forward integration -------------------------------------
  // Mirror the current navigable state into the History API so the Back button
  // (and the Android hardware back) steps through in-app states (Analytics →
  // Transactions → … ) instead of leaving straight to the previous page. Each
  // navigation pushes a history entry; popstate restores that entry's state.
  const routeState = useMemo(
    () => ({ view, analyticsTab, railPanel, paymentOpen, paymentTab, pickerOpen, mobilePanel }),
    [view, analyticsTab, railPanel, paymentOpen, paymentTab, pickerOpen, mobilePanel]
  )
  const lastKeyRef = useRef(null)
  const depthRef = useRef(0) // how many entries deep below Home we currently are

  // "Home" = chart view with nothing open. It's always the bottom of the stack,
  // so returning to it collapses everything above (Back from Home then leaves).
  const HOME = { view: 'trade', analyticsTab: 'Analytics', railPanel: null, paymentOpen: false, paymentTab: 'deposit', pickerOpen: false, mobilePanel: null }
  const HOME_KEY = JSON.stringify(HOME)

  useEffect(() => {
    const atHome =
      routeState.view === 'trade' && !routeState.railPanel && !routeState.paymentOpen && !routeState.pickerOpen && !routeState.mobilePanel
    const key = JSON.stringify(routeState)

    // first render: Home is the base; layer the current state on top only if we
    // opened straight into something (e.g. a restored Analytics tab)
    if (lastKeyRef.current === null) {
      depthRef.current = 0
      try { window.history.replaceState({ ...window.history.state, qx: HOME, qd: 0 }, '') } catch {}
      if (atHome) {
        lastKeyRef.current = HOME_KEY
      } else {
        depthRef.current = 1
        lastKeyRef.current = key
        try { window.history.pushState({ ...window.history.state, qx: routeState, qd: 1 }, '') } catch {}
      }
      return
    }

    if (key === lastKeyRef.current) return // applied from popstate / no real change

    // back to Home from a deeper state → collapse the stack to the base entry
    if (atHome) {
      const steps = depthRef.current
      lastKeyRef.current = HOME_KEY
      depthRef.current = 0
      if (steps > 0) {
        try { window.history.go(-steps) } catch {}
      } else {
        try { window.history.replaceState({ ...window.history.state, qx: HOME, qd: 0 }, '') } catch {}
      }
      return
    }

    // forward navigation into / between sub-states → push a new entry
    depthRef.current += 1
    lastKeyRef.current = key
    try { window.history.pushState({ ...window.history.state, qx: routeState, qd: depthRef.current }, '') } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeState])

  useEffect(() => {
    const onPop = (e) => {
      const s = e.state?.qx
      if (!s) return // left our managed stack — let the browser navigate away
      depthRef.current = e.state?.qd ?? 0
      const n = {
        view: s.view ?? 'trade',
        analyticsTab: s.analyticsTab ?? 'Analytics',
        railPanel: s.railPanel ?? null,
        paymentOpen: !!s.paymentOpen,
        paymentTab: s.paymentTab ?? 'deposit',
        pickerOpen: !!s.pickerOpen,
        mobilePanel: s.mobilePanel ?? null,
      }
      lastKeyRef.current = JSON.stringify(n) // stop the effect above from re-pushing
      setView(n.view)
      setAnalyticsTab(n.analyticsTab)
      setRailPanel(n.railPanel)
      setPaymentOpen(n.paymentOpen)
      setPaymentTab(n.paymentTab)
      setPickerOpen(n.pickerOpen)
      setMobilePanel(n.mobilePanel)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  const openPayment = (tab = 'deposit') => {
    setPaymentTab(tab)
    setPaymentOpen(true)
  }
  // Withdrawal is a full-page section (like the real Quotex), not a modal.
  const openWithdraw = () => {
    setPaymentOpen(false)
    setAnalyticsTab('Withdrawal')
    setView('analytics')
    setRailPanel(null)
  }
  const openTournaments = () => {
    setAnalyticsTab('Tournaments')
    setView('analytics')
    setRailPanel(null)
  }
  const openAccount = () => {
    setAnalyticsTab('My account')
    setView('analytics')
    setRailPanel(null)
  }
  // open the asset picker (same as "Market" in the More tab)
  const openMarket = () => {
    setRailPanel(null)
    setView('trade')
    setPickerOpen(true)
  }
  // logo / home: return to the chart and let the history stack collapse to base
  const goHome = () => {
    setView('trade')
    setRailPanel(null)
    setPaymentOpen(false)
    setPickerOpen(false)
    setMobilePanel(null)
  }

  async function logout() {
    try { localStorage.removeItem(UI_KEY); localStorage.removeItem(MARKET_KEY) } catch {}
    await fetch('/api/auth/logout', { method: 'POST' })
    disconnectSocket()
    router.push('/en/sign-in')
    router.refresh()
  }

  // initial data load
  useEffect(() => {
    fetchMe().then((user) => {
      setMe(user)
      if (!user) router.replace('/en/sign-in?next=/en/trade')
    })
    fetch('/api/assets')
      .then((r) => r.json())
      .then((d) => {
        const list = d.assets || []
        setAssets(list)
        // restore the tabs the user had open before refresh (filtered to assets
        // that still exist); otherwise open the first asset
        const valid = new Set(list.map((a) => a.symbol))
        const mk = loadJSON(MARKET_KEY)
        if (mk.timeframe) setTimeframe(mk.timeframe)
        const saved = (mk.openSymbols || []).filter((s) => valid.has(s))
        if (saved.length) {
          setOpenSymbols(saved, valid.has(mk.activeSymbol) ? mk.activeSymbol : undefined)
        } else if (list.length) {
          openSymbolTab(list[0].symbol)
        }
      })
      .catch(() => {})
    fetch('/api/trades?status=open')
      .then((r) => r.json())
      .then((d) => {
        if (d.trades) {
          setOpenTrades(
            d.trades.map((t) => ({
              id: t.id,
              symbol: t.symbol,
              direction: t.direction,
              amount: t.amount,
              payout: t.payout,
              openPrice: t.openPrice,
              closeTime: t.closeTime,
              accountType: t.accountType,
            }))
          )
        }
      })
      .catch(() => {})
    fetch('/api/trades?status=closed')
      .then((r) => r.json())
      .then((d) => d.trades && setHistory(d.trades))
      .catch(() => {})
    fetch('/api/payment-settings')
      .then((r) => r.json())
      .then((d) => d.announcement && setAnnouncement(d.announcement))
      .catch(() => {})
  }, [setMe, setAssets, openSymbolTab, setOpenSymbols, setTimeframe, setOpenTrades, setHistory, setAnnouncement, router])

  // socket events
  useEffect(() => {
    let sock
    let on = true
    const onSummary = (list) => setSummary(list)
    const onBalance = (b) => setBalance(b)
    const onTvMode = (d) => setTradingView(!!(d && d.on))
    const onClosed = (c) => {
      resolveOpenTrade(c.tradeId, c)
      if (c.balance) setBalance(c.balance)
      triggerFlash(c.result === 'win' ? 'win' : 'loss')
      pushToast({
        type: c.result === 'win' ? 'win' : 'loss',
        title: c.result === 'win' ? `Win +$${c.profit.toFixed(2)}` : `Loss -$${c.amount.toFixed(2)}`,
        msg: `${c.symbol} ${c.direction.toUpperCase()} · ${c.openPrice} → ${c.closePrice}`,
      })
    }
    getSocket().then((s) => {
      if (!on) return
      sock = s
      s.on('summary', onSummary)
      s.on('balance', onBalance)
      s.on('trade_closed', onClosed)
      s.on('tradingview_mode', onTvMode)
    })
    return () => {
      on = false
      if (sock) {
        sock.off('summary', onSummary)
        sock.off('balance', onBalance)
        sock.off('trade_closed', onClosed)
        sock.off('tradingview_mode', onTvMode)
      }
    }
  }, [setSummary, setBalance, resolveOpenTrade, triggerFlash, pushToast, setTradingView])

  return (
    <div className="flex h-[100dvh] flex-col bg-qx-bg text-white">
      <TradeHeader
        onHome={goHome}
        onDeposit={() => openPayment('deposit')}
        onWithdraw={openWithdraw}
        onAccountSection={(tab) => {
          setAnalyticsTab(tab)
          setView('analytics')
          setRailPanel(null)
        }}
        onToggleSidebar={() => setPickerOpen(true)}
        onMenuOpenChange={setAccountMenuOpen}
      />

      {announcement && (
        <div className="bg-qx-green/15 px-4 py-1.5 text-center text-xs font-medium text-qx-green">
          📢 {announcement}
        </div>
      )}

      {/* mobile bonus banner (under header) — hidden while the account dropdown
          is open so its green doesn't bleed around the dropdown card */}
      <button
        onClick={() => openPayment('deposit')}
        className={`mx-2 mt-1 flex shrink-0 items-center justify-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-qx-green to-emerald-500 px-3 py-1 text-xs font-medium text-white md:hidden ${
          accountMenuOpen ? 'invisible' : ''
        }`}
      >
        <span className="truncate whitespace-nowrap">🚀 Get a <b className="font-extrabold">50% bonus</b> on your deposit!</span>
        <span className="shrink-0 rounded-full bg-black/25 px-1.5 py-0.5 text-[10px] font-bold">50%</span>
      </button>

      <div className="flex flex-1 overflow-hidden">
        {/* left icon rail (tablet/desktop; phones use the bottom icon bar) */}
        <div className="hidden md:block">
          <LeftRail
            onTrade={() => {
              setView('trade')
              setRailPanel(null)
            }}
            onAccount={() => {
              setAnalyticsTab('My account')
              setView('analytics')
              setRailPanel(null)
            }}
            onSupport={() => setRailPanel((p) => (p === 'help' ? null : 'help'))}
            onMore={() => setRailPanel((p) => (p === 'more' || p === 'top' || p === 'signals' ? null : 'more'))}
            onTournaments={openTournaments}
            supportActive={railPanel === 'help'}
            moreActive={railPanel === 'more' || railPanel === 'top' || railPanel === 'signals'}
            accountActive={view === 'analytics' && analyticsTab !== 'Tournaments'}
            tournamentsActive={view === 'analytics' && analyticsTab === 'Tournaments'}
          />
        </div>

        {/* slide-out rail panels — push the chart area right when open */}
        <RailPanels
          panel={railPanel}
          setPanel={setRailPanel}
          onAnalytics={() => {
            setAnalyticsTab('Analytics')
            setView('analytics')
            setRailPanel(null)
          }}
          onMarket={() => {
            setRailPanel(null)
            setView('trade')
            setPickerOpen(true)
          }}
        />

        {view === 'analytics' ? (
          <main className="min-w-0 flex-1">
            <AnalyticsSection initialTab={analyticsTab} onTabChange={setAnalyticsTab} onMarket={openMarket} onWithdraw={openWithdraw} onDeposit={() => openPayment('deposit')} />
          </main>
        ) : (
          <>
            {/* center — chart fills the whole area; tabs + timeframe bar float on top of it */}
            <main className="flex min-w-0 flex-1 flex-col">
              <div className="relative min-h-0 flex-1">
                <CandlestickChart />
                <div className="absolute inset-x-0 top-0 z-20 hidden md:block">
                  <AssetTabs pickerOpen={pickerOpen} onToggle={() => setPickerOpen((o) => !o)} />
                </div>
                {pickerOpen && <AssetPickerModal onClose={() => setPickerOpen(false)} />}
              </div>
            </main>

            {/* right: trade panel + compact trades list (tablet/desktop) */}
            <aside className="hidden w-[264px] shrink-0 flex-col overflow-hidden border-l border-qx-border md:flex">
              <div className="shrink-0">
                <TradePanel onPickAsset={() => setPickerOpen(true)} />
              </div>
              {/* trades card fills the remaining space below the trade panel,
                  top-aligned; its body scrolls and its handle collapses it
                  upward (the collapsed bar stays at the top) */}
              <div className="flex min-h-0 flex-1 flex-col">
                <BottomTabs fill />
              </div>
            </aside>
          </>
        )}
      </div>

      {/* mobile inline trade panel (always visible, no scrolling) */}
      {view === 'trade' && (
        <div className="mt-2 shrink-0 border-t border-qx-border pt-1 md:hidden">
          <TradePanel mobile onPickAsset={() => setPickerOpen(true)} />
        </div>
      )}

      {/* mobile slide-in sheets (More / Help / TOP / Signals) */}
      <MobileSheets
        panel={railPanel}
        setPanel={setRailPanel}
        onAnalytics={() => {
          setAnalyticsTab('Analytics')
          setView('analytics')
          setRailPanel(null)
        }}
        onAccountSection={(tab) => {
          setAnalyticsTab(tab)
          setView('analytics')
          setRailPanel(null)
        }}
        onMarket={() => {
          setRailPanel(null)
          setView('trade')
          setPickerOpen(true)
        }}
        onDeposit={() => {
          setRailPanel(null)
          openPayment('deposit')
        }}
        onWithdraw={() => {
          setRailPanel(null)
          openWithdraw()
        }}
        onTrades={() => {
          setRailPanel(null)
          setMobilePanel('history')
        }}
        onLogout={logout}
      />

      {/* mobile bottom icon bar */}
      <MobileNav
        view={view}
        panel={railPanel}
        tournamentsActive={view === 'analytics' && analyticsTab === 'Tournaments'}
        accountActive={view === 'analytics' && analyticsTab === 'My account'}
        onChart={() => {
          setView('trade')
          setRailPanel(null)
        }}
        onHelp={() => setRailPanel((p) => (p === 'help' ? null : 'help'))}
        onAccount={openAccount}
        onTop={openTournaments}
        onMore={() => setRailPanel((p) => (p === 'more' ? null : 'more'))}
      />

      {/* mobile drawers */}
      {mobilePanel === 'history' && (
        <Drawer side="bottom" onClose={() => setMobilePanel(null)} title="Trades & History">
          <div className="h-[60vh]">
            <BottomTabs />
          </div>
        </Drawer>
      )}

      {paymentOpen && <PaymentModal onClose={() => setPaymentOpen(false)} />}
      <Toasts />
    </div>
  )
}

// Icon-only bottom bar like the real Quotex mobile app:
// chart · help · account · tournaments · more (with badges).
function MobileNav({ view, panel, tournamentsActive, accountActive, onChart, onHelp, onAccount, onTop, onMore }) {
  const chartActive = view === 'trade' && !panel
  const items = [
    {
      id: 'chart',
      onClick: onChart,
      active: chartActive,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <path d="M7 14l3-3.5 2.5 2.5L17 8.5" fill="none" stroke="#131A26" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      id: 'help',
      onClick: onHelp,
      active: panel === 'help',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.6 9.2a2.4 2.4 0 113.4 2.2c-.8.4-1 .9-1 1.7M12 16.6h.01" fill="none" stroke="#131A26" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      id: 'account',
      onClick: onAccount,
      active: accountActive,
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="8" r="4" /><path d="M4 20a8 8 0 0116 0z" />
        </svg>
      ),
    },
    {
      id: 'top',
      onClick: onTop,
      active: tournamentsActive,
      badge: '4',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 4h12v4a6 6 0 01-12 0z" />
          <path d="M6 6H3v1a3 3 0 003 3M18 6h3v1a3 3 0 01-3 3M9 19h6M12 14v5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      id: 'more',
      onClick: onMore,
      active: panel === 'more',
      badge: '4',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          <rect x="2.5" y="4.5" width="19" height="15" rx="4" />
          <circle cx="8" cy="12" r="1.4" fill="#131A26" /><circle cx="12" cy="12" r="1.4" fill="#131A26" /><circle cx="16" cy="12" r="1.4" fill="#131A26" />
        </svg>
      ),
    },
  ]
  return (
    <nav className="relative z-50 grid grid-cols-5 border-t border-qx-border bg-qx-panel md:hidden">
      {items.map((it) => (
        <button key={it.id} onClick={it.onClick} className="relative flex items-center justify-center py-2.5">
          <span className={it.active ? 'text-white' : 'text-qx-textDim'}>{it.icon}</span>
          {it.badge && (
            <span className="absolute left-1/2 top-1 ml-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#2F8FEE] px-1 text-[10px] font-bold text-white">
              {it.badge}
            </span>
          )}
        </button>
      ))}
    </nav>
  )
}

function Drawer({ side, onClose, title, children }) {
  const isBottom = side === 'bottom'
  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        className={`absolute bg-qx-panel ${
          isBottom
            ? 'inset-x-0 bottom-0 rounded-t-2xl'
            : 'inset-y-0 left-0 w-[280px]'
        }`}
      >
        <div className="flex items-center justify-between border-b border-qx-border px-4 py-3">
          <span className="font-bold text-white">{title}</span>
          <button onClick={onClose} className="text-qx-textDim">✕</button>
        </div>
        <div className={isBottom ? '' : 'h-[calc(100%-49px)]'}>{children}</div>
      </div>
    </div>
  )
}
