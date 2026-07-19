'use client'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import QuotexLogo from '@/components/ui/QuotexLogo'
import { fetchMe } from '@/lib/authClient'

const NAV = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/health', label: 'Health' },
  { href: '/admin/live', label: 'Live trades' },
  { href: '/admin/candles', label: 'Candle control' },
  { href: '/admin/deposits', label: 'Deposits' },
  { href: '/admin/withdrawals', label: 'Withdrawals' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/assets', label: 'Assets' },
  { href: '/admin/tournaments', label: 'Tournaments' },
  { href: '/admin/audit', label: 'Audit log' },
  { href: '/admin/settings', label: 'Settings' },
]

export default function AdminShell({ children }) {
  const router = useRouter()
  const pathname = usePathname()
  const [state, setState] = useState('loading') // loading | ok | denied

  // The admin login page lives under /admin but must render without the guard
  // or the sidebar chrome (otherwise it would redirect itself away).
  const isSignIn = pathname === '/admin/sign-in'

  useEffect(() => {
    if (isSignIn) return
    fetchMe().then((user) => {
      if (user?.role === 'admin') setState('ok')
      else {
        setState('denied')
        router.push('/admin/sign-in')
      }
    })
  }, [router, isSignIn])

  if (isSignIn) return children

  if (state !== 'ok') {
    return (
      <div className="flex h-screen items-center justify-center bg-qx-bg text-qx-textDim">
        {state === 'loading' ? 'Checking access…' : 'Redirecting…'}
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-qx-bg text-white">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-qx-border bg-qx-panel md:flex">
        <div className="border-b border-qx-border p-5">
          <QuotexLogo textClass="text-lg" />
          <div className="mt-1 text-xs text-qx-textMute">Admin panel</div>
        </div>
        <nav className="flex-1 overflow-y-auto p-3">
          {NAV.map((n) => {
            const active = pathname === n.href
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`mb-1 block rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                  active ? 'bg-qx-green text-white' : 'text-qx-textDim hover:bg-qx-panel2 hover:text-white'
                }`}
              >
                {n.label}
              </Link>
            )
          })}
        </nav>
        <div className="m-3 space-y-2">
          <Link href="/en/trade" className="block rounded-lg bg-qx-panel2 px-4 py-2.5 text-center text-sm font-semibold hover:bg-qx-border">
            ← Back to terminal
          </Link>
          <LogoutButton />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* mobile top nav */}
        <div className="sticky top-0 z-30 flex items-center gap-1 overflow-x-auto border-b border-qx-border bg-qx-panel p-2 md:hidden">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold ${
                pathname === n.href ? 'bg-qx-green text-white' : 'text-qx-textDim'
              }`}
            >
              {n.label}
            </Link>
          ))}
          <div className="ml-auto shrink-0">
            <MobileLogout />
          </div>
        </div>
        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}

function LogoutButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function logout() {
    setBusy(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {}
    router.push('/admin/sign-in')
  }

  return (
    <button
      onClick={logout}
      disabled={busy}
      className="w-full rounded-lg border border-qx-red/40 px-4 py-2.5 text-center text-sm font-semibold text-qx-red hover:bg-qx-red/10 disabled:opacity-50"
    >
      {busy ? 'Logging out…' : 'Log out'}
    </button>
  )
}

function MobileLogout() {
  const router = useRouter()
  async function logout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {}
    router.push('/admin/sign-in')
  }
  return (
    <button
      onClick={logout}
      className="rounded-lg px-3 py-1.5 text-xs font-bold text-qx-red hover:bg-qx-red/10"
    >
      Log out
    </button>
  )
}
