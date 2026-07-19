'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import FloatingInput from '@/components/ui/FloatingInput'

const COUNTRIES = [
  'Pakistan', 'India', 'Bangladesh', 'United Arab Emirates', 'Saudi Arabia',
  'United Kingdom', 'Germany', 'France', 'Spain', 'Italy', 'Turkey', 'Egypt',
  'Nigeria', 'South Africa', 'Brazil', 'Mexico', 'Indonesia', 'Malaysia',
  'Philippines', 'Vietnam', 'Thailand', 'Japan', 'South Korea', 'Australia',
]
const CURRENCIES = ['USD', 'PKR', 'EUR', 'GBP', 'INR', 'AED']

function EyeIcon({ off }) {
  return off ? (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8" />
      <path d="M9.4 5.2A9.5 9.5 0 0112 5c5 0 9 4.5 9 7 0 1-.7 2.3-1.9 3.4M6.1 6.1C4 7.4 3 9.2 3 12c0 0 4 7 9 7 1.3 0 2.5-.3 3.6-.8" />
    </svg>
  ) : (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  )
}

const GlobeIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
  </svg>
)

// Custom dropdown with the notched-outline look — replaces the native
// <select>, whose OS-rendered white popup clashes with the dark theme.
function SelectField({ label, icon, value, onChange, options, searchable = false, placeholder = 'Search' }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const shown =
    searchable && q ? options.filter((o) => o.toLowerCase().includes(q.toLowerCase())) : options

  function close() {
    setOpen(false)
    setQ('')
  }
  function pick(o) {
    onChange(o)
    close()
  }

  return (
    <div className="relative">
      <div
        className="relative rounded-md border transition-colors"
        style={{ borderColor: open ? '#8B95A7' : '#525D6F' }}
      >
        <label className="pointer-events-none absolute -top-2 left-3 z-[1] bg-[#3E4859] px-1 text-[11px] text-[#9AA4B5]">
          {label}
        </label>
        <button
          type="button"
          onClick={() => (open ? close() : setOpen(true))}
          className="flex w-full items-center gap-2 px-3 py-[18px] text-left"
        >
          {icon && <span className="text-[#8A93A6]">{icon}</span>}
          <span className={`flex-1 text-[15px] ${value ? 'text-white' : 'text-[#8A93A6]'}`}>
            {value || placeholder}
          </span>
          <svg
            width="18" height="18" viewBox="0 0 24 24" fill="none"
            className={`text-[#8A93A6] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          >
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={close} />
          <div className="absolute inset-x-0 top-full z-30 mt-1.5 overflow-hidden rounded-lg border border-[#525D6F] bg-[#2F3847] shadow-2xl">
            {searchable && (
              <div className="border-b border-[#454F61] p-2">
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search"
                  className="w-full rounded-md bg-[#262E3B] px-3 py-2 text-[14px] text-white placeholder-[#8A93A6] outline-none"
                />
              </div>
            )}
            <div className="max-h-56 overflow-y-auto py-1">
              {shown.map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => pick(o)}
                  className={`block w-full px-4 py-2.5 text-left text-[14px] transition ${
                    o === value ? 'bg-[#2F8FEE]/25 font-semibold text-white' : 'text-white/90 hover:bg-white/5'
                  }`}
                >
                  {o}
                </button>
              ))}
              {!shown.length && <div className="px-4 py-3 text-sm text-[#8A93A6]">No results</div>}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function CheckBox({ checked, onChange }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[4px] border-2 transition ${
        checked ? 'border-[#2F8FEE] bg-[#2F8FEE]' : 'border-[#8A93A6] bg-transparent'
      }`}
    >
      {checked && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
          <path d="M5 12l5 5 9-11" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  )
}

export default function AuthCard({ mode = 'register', admin = false }) {
  const router = useRouter()
  const search = useSearchParams()
  const [country, setCountry] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [agree, setAgree] = useState(false)
  const [notUS, setNotUS] = useState(false)
  const [remember, setRemember] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const isRegister = !admin && mode === 'register'
  const next = search.get('next') || (admin ? '/admin' : '/en/trade')

  // surface an OAuth error redirected back from /api/auth/google
  const oauthError = search.get('error')

  // Google sign-in is only attempted when explicitly enabled (and the server has
  // the OAuth credentials). When it isn't, show a friendly "coming soon" notice
  // instead of bouncing through a redirect — so a missing env never breaks UX.
  const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_ENABLED === 'true'
  function googleSignIn() {
    if (!googleEnabled) {
      setError('')
      setNotice('Google sign-in is coming soon. Please continue with email for now.')
      return
    }
    window.location.href = `/api/auth/google?next=${encodeURIComponent(next)}`
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (isRegister && (!agree || !notUS)) {
      setError('Please accept the agreements to continue.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(isRegister ? '/api/auth/signup' : '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isRegister
            ? { email, password, country, currency }
            : admin
            ? { email, password, scope: 'admin' }
            : { email, password }
        ),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong.')
        setLoading(false)
        return
      }
      // Admins always land on the admin panel — both from the dedicated admin
      // page and if they happen to log in through the normal user page.
      const dest = admin || data.user?.role === 'admin' ? '/admin' : next
      router.push(dest)
      router.refresh()
    } catch {
      setError('Network error. Is the server running?')
      setLoading(false)
    }
  }

  return (
    <div
      className="mx-auto w-full max-w-[450px] rounded-xl shadow-2xl"
      style={{ background: '#3E4859' }}
    >
      {/* segmented toggle band, separated from the form by a full-width divider */}
      <div className="border-b border-[#4A5466] px-6 py-7">
        {admin ? (
          <div className="mx-auto flex w-full max-w-[340px] items-center justify-center gap-2 rounded-lg py-2.5 text-[15px] font-bold text-white" style={{ background: '#384150' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 3l8 4v5c0 4.5-3 7.5-8 9-5-1.5-8-4.5-8-9V7z" strokeLinejoin="round" />
              <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Administrator login
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-[340px] rounded-lg p-1.5" style={{ background: '#384150' }}>
            <button
              onClick={() => router.push('/en/sign-in')}
              className={`flex-1 rounded-md py-2.5 text-[15px] font-bold transition ${
                !isRegister ? 'border border-[#5C6678] bg-[#454F61] text-white' : 'border border-transparent text-white/85'
              }`}
            >
              Login
            </button>
            <button
              onClick={() => router.push('/en/sign-up')}
              className={`flex-1 rounded-md py-2.5 text-[15px] font-bold transition ${
                isRegister ? 'border border-[#5C6678] bg-[#454F61] text-white' : 'border border-transparent text-white/85'
              }`}
            >
              Registration
            </button>
          </div>
        )}
      </div>

      <div className="px-5 pb-9 pt-8 sm:px-8">
        <form onSubmit={submit} className="space-y-6">
          {isRegister && (
            <>
              <SelectField
                label="Country / Region of residence"
                icon={GlobeIcon}
                value={country}
                onChange={setCountry}
                options={COUNTRIES}
                searchable
                placeholder="Search"
              />

              <SelectField
                label="Currency"
                value={currency}
                onChange={setCurrency}
                options={CURRENCIES}
              />
            </>
          )}

          <FloatingInput
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <FloatingInput
            label="Password"
            type={showPw ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            rightSlot={
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                className="pr-3 text-[#8A93A6] hover:text-white"
                tabIndex={-1}
              >
                <EyeIcon off={showPw} />
              </button>
            }
          />

          {isRegister ? (
            <div className="space-y-5 pt-1">
              <label className="flex cursor-pointer items-start gap-3 text-[15px] leading-snug text-white">
                <CheckBox checked={agree} onChange={setAgree} />
                <span>
                  I confirm that I am 18 years old or older and accept{' '}
                  <span className="text-[#5B9BFF]">Service Agreement</span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 text-[15px] leading-snug text-white">
                <CheckBox checked={notUS} onChange={setNotUS} />
                <span>I declare and confirm that I am not a citizen or resident of the US for tax purposes</span>
              </label>
            </div>
          ) : (
            <div className="flex items-center justify-between text-[15px]">
              <label className="flex cursor-pointer items-center gap-3 text-white">
                <CheckBox checked={remember} onChange={setRemember} />
                Remember me
              </label>
              <span className="cursor-pointer text-[#5B9BFF]">Forgot password?</span>
            </div>
          )}

          {(error || oauthError) && (
            <div className="rounded-lg bg-qx-red/15 px-4 py-2.5 text-sm text-qx-red">{error || oauthError}</div>
          )}
          {notice && (
            <div className="rounded-lg bg-[#2F8FEE]/15 px-4 py-2.5 text-sm text-[#5B9BFF]">{notice}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 rounded-lg py-[18px] text-[17px] font-bold text-white transition hover:brightness-110 disabled:opacity-60"
            style={{ background: '#2B9AF3' }}
          >
            {loading ? 'Please wait…' : isRegister ? 'Registration' : 'Log in'}
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/25">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </button>
        </form>

        {!admin && (
        <>
        <div className="my-8 flex items-center gap-4 text-[15px] text-[#9AA4B5]">
          <span className="h-px flex-1 bg-[#4A5466]" />
          Sign in via
          <span className="h-px flex-1 bg-[#4A5466]" />
        </div>

        <div className="flex justify-center pb-2">
          <button
            type="button"
            onClick={googleSignIn}
            className="flex h-[70px] w-[114px] items-center justify-center rounded-lg bg-white shadow transition hover:bg-white/90"
            title="Continue with Google"
          >
            <svg width="32" height="32" viewBox="0 0 48 48">
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
              <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35 26.7 36 24 36c-5.3 0-9.7-3.1-11.3-7.8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.3 5.3C41.3 36.3 44 30.7 44 24c0-1.3-.1-2.3-.4-3.5z" />
            </svg>
          </button>
        </div>

     
        </>
        )}
      </div>
    </div>
  )
}
