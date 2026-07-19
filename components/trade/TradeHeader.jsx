'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useStore } from '@/lib/store'
import QuotexLogo from '@/components/ui/QuotexLogo'
import { disconnectSocket } from '@/lib/socketClient'

export default function TradeHeader({ onHome, onDeposit, onWithdraw, onToggleSidebar, onAccountSection, onMenuOpenChange }) {
  const router = useRouter()
  const me = useStore((s) => s.me)
  const accountType = useStore((s) => s.accountType)
  const setAccountType = useStore((s) => s.setAccountType)
  const balance = useStore((s) => s.balance)

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    disconnectSocket()
    router.push('/en/sign-in')
    router.refresh()
  }

  return (
    <header className="flex h-12 items-center justify-between gap-2 border-b border-qx-border bg-qx-panel px-2 md:h-14 md:gap-3 md:px-4">
      <div className="flex items-center gap-3">
        <button onClick={onToggleSidebar} className="hidden text-white sm:block lg:hidden" aria-label="Assets">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
          </svg>
        </button>
        <button onClick={onHome} className="hidden sm:block" aria-label="Home">
          <QuotexLogo textClass="text-lg" />
        </button>
      </div>

      {/* promo banner (center) */}
      <div className="hidden flex-1 justify-center lg:flex">
        <div className="flex items-center gap-2 rounded-full bg-qx-green/15 px-4 py-1.5 text-sm font-semibold text-qx-green">
          🚀 Get a 50% bonus on your deposit!
          <span className="rounded-full bg-qx-green px-2 py-0.5 text-xs font-bold text-white">50%</span>
        </div>
      </div>

      <div className="flex min-w-0 items-center gap-1.5 md:gap-3">
        {/* notifications — boxed bell with inline badge; sits after the account
            selector on mobile (like the real app) and before it on md+ */}
        <button className="order-2 flex shrink-0 items-center gap-1 rounded-lg bg-qx-input px-1.5 py-1.5 text-qx-textDim hover:text-white md:order-1 md:gap-1.5 md:px-2.5 md:py-[7px]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="md:h-[18px] md:w-[18px]">
            <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" strokeLinecap="round" />
          </svg>
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-qx-red px-1 text-[10px] font-bold text-white md:h-5 md:min-w-5 md:text-[11px]">2</span>
        </button>

        <div className="order-1 min-w-0 md:order-2">
          <AccountMenu
            me={me}
            accountType={accountType}
            setAccountType={setAccountType}
            balance={balance}
            onDeposit={onDeposit}
            onWithdraw={onWithdraw}
            onAccountSection={onAccountSection}
            onOpenChange={onMenuOpenChange}
            onLogout={logout}
          />
        </div>

        <button
          onClick={onDeposit}
          className="order-3 flex shrink-0 items-center gap-1 rounded-lg bg-qx-green px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-qx-greenHover md:px-4 md:py-2 md:text-xs"
        >
          <span className="hidden text-base leading-none md:inline">+</span> Deposit
        </button>
        <button
          onClick={onWithdraw}
          className="order-4 hidden rounded-lg bg-qx-panel2 px-3 py-2 text-xs font-bold text-white hover:bg-qx-border md:inline-flex md:px-4"
        >
          Withdrawal
        </button>

      </div>
    </header>
  )
}

// Quotex-style account dropdown: account summary on the left, quick menu on the
// right (menu column collapses away on mobile).
function AccountMenu({ me, accountType, setAccountType, balance, onDeposit, onWithdraw, onAccountSection, onOpenChange, onLogout }) {
  const [open, setOpen] = useState(false)
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    onOpenChange?.(open)
  }, [open, onOpenChange])
  const isReal = accountType === 'real'
  const cur = isReal ? balance.realBalance : balance.demoBalance
  const fmt = (n) =>
    `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const mask = (s) => (hidden ? '$ •••••' : s)
  // stable numeric-looking ID derived from the Mongo ObjectId
  const accountId = me?.id ? String(parseInt(me.id.slice(0, 8), 16)).slice(0, 8) : ''

  const Cap = (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M2 9l10-4 10 4-10 4zM6 11v5c0 1.1 2.7 2.5 6 2.5s6-1.4 6-2.5v-5M22 9v5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
  // live account shows the paper plane (like the real app); demo keeps the cap
  const Plane = (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M2 21l21-9L2 3v7l15 2-15 2z" />
    </svg>
  )
  const TypeIcon = isReal ? Plane : Cap

  function pick(type) {
    setAccountType(type)
  }
  function act(fn) {
    setOpen(false)
    if (fn) fn()
  }

  const MENU = [
    { label: 'Deposit', fn: onDeposit },
    { label: 'Withdrawal', fn: onWithdraw },
    { label: 'Transactions', fn: () => onAccountSection?.('Transactions') },
    { label: 'Trades', fn: () => onAccountSection?.('Trades') },
    { label: 'My account', fn: () => onAccountSection?.('My account') },
  ]

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-lg bg-qx-input px-1.5 py-1 text-white hover:bg-qx-panel2 md:gap-2 md:px-2.5 md:py-1.5"
      >
        <span className={`[&>svg]:h-4 [&>svg]:w-4 md:[&>svg]:h-[22px] md:[&>svg]:w-[22px] ${isReal ? 'text-qx-green' : 'text-qx-gold'}`}>{TypeIcon}</span>
        <div className="flex items-baseline gap-1 text-left leading-tight sm:block md:gap-1.5">
          <div className={`text-[9px] font-bold uppercase md:text-[10px] ${isReal ? 'text-qx-green' : 'text-qx-gold'}`}>
            {isReal ? 'Live' : 'Demo'}<span className="hidden sm:inline"> account</span>
          </div>
          <div className="text-[13px] font-bold tabular-nums text-white md:text-sm">{mask(fmt(cur))}</div>
        </div>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className={`text-qx-textDim transition-transform duration-200 md:h-4 md:w-4 ${open ? 'rotate-180' : ''}`}
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div
            className="fixed left-2 top-14 z-40 w-[min(340px,calc(100vw-5rem))] max-h-[calc(100dvh-5rem)] overflow-y-auto overflow-x-hidden rounded-2xl border border-qx-border p-3 shadow-panel md:absolute md:left-auto md:-right-2 md:top-12 md:w-[620px] md:max-w-[calc(100vw-1rem)] md:p-5"
            style={{ background: '#0D1119' }}
          >
            <div className="flex gap-5">
              {/* left: account summary */}
              <div className="min-w-0 flex-1">
                {/* STANDARD: +0% profit  +  eye */}
                <div className="flex items-stretch gap-2">
                  <div className="flex flex-1 items-center gap-2 rounded-lg px-3 py-2 md:gap-3 md:px-4 md:py-2.5" style={{ background: '#2A3140' }}>
                    <svg className="h-[18px] w-[18px] shrink-0 md:h-[22px] md:w-[22px]" viewBox="0 0 24 24" fill="#00C076">
                      <path d="M2 21l21-9L2 3v7l15 2-15 2z" />
                    </svg>
                    <div className="leading-tight">
                      <div className="text-[9px] font-bold uppercase tracking-wide text-qx-textDim md:text-[10px]">Standard:</div>
                      <div className="text-[13px] font-bold text-white md:text-[15px]">+0% profit</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setHidden((h) => !h)}
                    className="flex w-[44px] items-center justify-center rounded-lg text-white hover:text-qx-textDim md:w-[58px]"
                    style={{ background: '#2A3140' }}
                    title="Hide balance"
                  >
                    {hidden ? (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8" />
                        <path d="M9.4 5.2A9.5 9.5 0 0112 5c5 0 9 4.5 9 7 0 1-.7 2.3-1.9 3.4M6.1 6.1C4 7.4 3 9.2 3 12c0 0 4 7 9 7 1.3 0 2.5-.3 3.6-.8" />
                      </svg>
                    ) : (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
                        <circle cx="12" cy="12" r="2.6" />
                      </svg>
                    )}
                  </button>
                </div>

                <div className="mt-3 truncate text-[13px] font-bold text-white md:mt-4 md:text-[15px]">{me?.email}</div>
                <div className="mt-0.5 text-xs text-qx-textDim md:mt-1 md:text-sm">ID: {accountId}</div>
                <div className="mt-2 flex items-center gap-2 text-[13px] md:text-[15px]">
                  <span className="text-qx-textDim">Currency:</span>
                  <span className="font-bold text-white">{me?.currency || 'USD'}</span>
                  <button className="rounded bg-[#2F8FEE] px-2 py-0.5 text-[10px] font-bold text-white hover:brightness-110">
                    CHANGE
                  </button>
                </div>

                {/* Live account */}
                <button
                  onClick={() => pick('real')}
                  className="mt-3 block w-full rounded-xl p-3 text-left md:mt-4 md:p-4"
                  style={{ background: '#151A26' }}
                >
                  <div className="flex items-center gap-3">
                    <Radio active={isReal} />
                    <span className="text-sm font-semibold text-white md:text-[15px]">Live Account</span>
                  </div>
                  <div className="mt-1 pl-8 text-base font-bold tabular-nums text-white md:mt-1.5 md:text-[17px]">
                    {mask(fmt(balance.realBalance))}
                  </div>
                  <div className="mt-0.5 pl-8 text-xs text-qx-textDim md:mt-1 md:text-sm">The daily limit is not set</div>
                  <div className="mt-1.5 pl-8 text-xs font-bold tracking-wide text-[#2F8FEE] md:mt-2">SET LIMIT</div>
                </button>

                {/* Demo account */}
                <button
                  onClick={() => pick('demo')}
                  className="mt-2 block w-full rounded-xl p-3 text-left md:p-4"
                  style={{ background: '#151A26' }}
                >
                  <div className="flex items-center gap-3">
                    <Radio active={!isReal} />
                    <span className="flex-1 text-sm font-semibold text-white md:text-[15px]">Demo Account</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-qx-textDim hover:text-white">
                      <path d="M14 4l6 6-9 9H5v-6z" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div className="mt-1 flex items-center gap-2 pl-8 md:mt-1.5">
                    <span className="text-base font-bold tabular-nums text-white md:text-[17px]">{mask(fmt(balance.demoBalance))}</span>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-qx-textDim">
                      <path d="M21 12a9 9 0 11-2.6-6.3M21 3v6h-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </button>
              </div>

              {/* right: quick menu (desktop only) */}
              <div className="hidden w-[180px] shrink-0 flex-col py-1 md:flex">
                {MENU.map((m) => (
                  <button
                    key={m.label}
                    onClick={() => act(m.fn)}
                    className="rounded-md px-3 py-2.5 text-left text-[15px] text-white hover:bg-white/5"
                  >
                    {m.label}
                  </button>
                ))}
                <div className="my-2 border-t border-white/10" />
                <button
                  onClick={() => act(onLogout)}
                  className="flex items-center gap-2 rounded-md px-3 py-2.5 text-left text-[15px] text-qx-red hover:bg-white/5"
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 4h4v16h-4M10 17l5-5-5-5M15 12H3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Logout
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Radio({ active }) {
  return active ? (
    <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-[#2F8FEE]">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
        <path d="M5 12l5 5 9-11" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  ) : (
    <span className="h-[22px] w-[22px] shrink-0 rounded-full border-2 border-[#566273]" />
  )
}
