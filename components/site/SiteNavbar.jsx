'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import QuotexLogo from '@/components/ui/QuotexLogo'
import { disconnectSocket } from '@/lib/socketClient'
import { fetchMe } from '@/lib/authClient'

const NAV = [
  { label: 'Demo account', href: '/en/sign-up' },
  { label: 'About us', href: '#about' },
  { label: 'FAQ', href: '#faq' },
  { label: 'Blog', href: '#blog' },
]

export default function SiteNavbar() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [me, setMe] = useState(undefined) // undefined = loading, null = logged out

  useEffect(() => {
    let on = true
    fetchMe().then((user) => on && setMe(user))
    return () => {
      on = false
    }
  }, [])

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    disconnectSocket()
    setMe(null)
    router.refresh()
  }

  return (
    <header className="relative z-20">
      <nav className="mx-auto flex max-w-[1600px] items-center justify-between px-5 py-5 md:px-10">
        <Link href="/apkdownload">
          <QuotexLogo />
        </Link>

        <ul className="hidden items-center gap-9 lg:flex">
          {NAV.map((n) => (
            <li key={n.label}>
              <Link
                href={n.href}
                className="text-[15px] font-bold text-white/90 transition hover:text-white"
              >
                {n.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-3">
          {me ? (
            <>
              <Link
                href="/en/trade"
                className="rounded-lg bg-qx-green px-5 py-2.5 text-sm font-bold text-white transition hover:bg-qx-greenHover"
              >
                Go to terminal
              </Link>
              <button
                onClick={logout}
                className="hidden rounded-lg bg-qx-panel2 px-4 py-2.5 text-sm font-bold text-white hover:bg-qx-border sm:inline-flex"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/en/sign-in"
                className="hidden rounded-lg bg-qx-panel2 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-qx-border sm:inline-flex"
              >
                Log in
              </Link>
              <Link
                href="/en/sign-up"
                className="rounded-lg bg-qx-green px-5 py-2.5 text-sm font-bold text-white transition hover:bg-qx-greenHover"
              >
                Sign up
              </Link>
            </>
          )}

          <button className="hidden items-center gap-1 text-sm font-semibold text-white/80 md:flex">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
              <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" stroke="currentColor" strokeWidth="1.6" />
            </svg>
            EN
          </button>
          <button
            className="lg:hidden text-white"
            onClick={() => setOpen((o) => !o)}
            aria-label="Menu"
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </nav>

      {open && (
        <div className="border-t border-qx-border bg-qx-panel px-5 py-3 lg:hidden">
          {NAV.map((n) => (
            <Link
              key={n.label}
              href={n.href}
              className="block py-2 text-[15px] font-semibold text-white/90"
              onClick={() => setOpen(false)}
            >
              {n.label}
            </Link>
          ))}
          {me ? (
            <button onClick={logout} className="block py-2 text-[15px] font-semibold text-qx-red">
              Log out
            </button>
          ) : (
            <Link href="/en/sign-in" className="block py-2 text-[15px] font-semibold text-white/90">
              Log in
            </Link>
          )}
        </div>
      )}
    </header>
  )
}
