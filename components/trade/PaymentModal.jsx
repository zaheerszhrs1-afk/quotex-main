'use client'
import { useEffect, useMemo, useState } from 'react'
import { useStore } from '@/lib/store'
import { BONUS_CODES, bonusFor, normalizeCode } from '@/lib/depositBonus'
import PaymentLogo from './PaymentLogo'

// Deposit cashier — Quotex-style flow: choose a method, enter amount, apply a
// bonus code, then submit manual payment proof for admin approval.
export default function PaymentModal({ onClose }) {
  const [settings, setSettings] = useState({ methods: [], minDeposit: 10 })
  const [method, setMethod] = useState(null)

  useEffect(() => {
    fetch('/api/payment-settings')
      .then((r) => r.json())
      .then((d) => setSettings(d))
      .catch(() => {})
  }, [])

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center md:items-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative z-10 flex h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl bg-[#2B3344] text-white shadow-panel md:h-[88vh] md:rounded-2xl">
        <div className="flex items-center justify-between px-5 py-4 md:px-7 md:py-5">
          <h2 className="text-2xl font-extrabold md:text-3xl">
            {method ? (
              <button onClick={() => setMethod(null)} className="flex items-center gap-3 hover:text-qx-textDim">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#3A4356] text-white">‹</span>
                Deposit
              </button>
            ) : (
              'Deposit'
            )}
          </h2>
          <button onClick={onClose} className="text-4xl leading-none text-qx-textDim hover:text-white">×</button>
        </div>
        <div className="mx-5 border-t border-dashed border-white/20 md:mx-7" />

        {method ? (
          <DepositForm method={method} minDeposit={settings.minDeposit} onClose={onClose} onChangeMethod={() => setMethod(null)} />
        ) : (
          <DepositBrowser settings={settings} onPick={setMethod} />
        )}
      </div>
    </div>
  )
}

const CAT_ICONS = {
  popular: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.6 1.4 6.8L12 17.8 5.9 20.4l1.4-6.8L2.2 9l6.9-.7z" /></svg>
  ),
  mobile: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18" strokeLinecap="round" /></svg>
  ),
  bank: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2.5" y="7" width="15" height="10" rx="2" /><path d="M6.5 11h15v10h-15z" fill="currentColor" stroke="none" opacity="0.35" /></svg>
  ),
  crypto: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l8.5 5v10L12 22l-8.5-5V7z" /></svg>
  ),
}

const CATEGORIES = [
  { id: 'popular', label: 'POPULAR', match: (m) => m.popular },
  { id: 'mobile', label: 'E-PAY', match: (m) => m.type === 'mobile' },
  { id: 'bank', label: 'BANKS', match: (m) => m.type === 'bank' },
  { id: 'crypto', label: 'CRYPTO', match: (m) => m.type === 'crypto' },
]
const GROUP_TITLES = { popular: 'Popular in your region', mobile: 'E-Pay', bank: 'Banks', crypto: 'Crypto' }

function DepositBrowser({ settings, onPick }) {
  const [cat, setCat] = useState('popular')
  const methods = settings.methods || []
  const minDeposit = settings.minDeposit || 10

  const byCat = useMemo(() => {
    const m = {}
    for (const c of CATEGORIES) m[c.id] = methods.filter(c.match)
    return m
  }, [methods])

  const sections =
    cat === 'popular'
      ? ['popular', 'mobile', 'bank', 'crypto'].map((id) => ({ id, items: byCat[id] })).filter((s) => s.items.length)
      : [{ id: cat, items: byCat[cat] }]

  if (!methods.length) {
    return <div className="flex flex-1 items-center justify-center text-sm text-qx-textMute">No payment methods are enabled.</div>
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 md:flex-row md:gap-5 md:p-6">
      <div className="grid shrink-0 grid-cols-4 gap-2 md:flex md:w-56 md:flex-col">
        {CATEGORIES.map((c) => {
          const items = byCat[c.id]
          const active = cat === c.id
          return (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              className={`rounded-2xl px-2 py-2.5 transition md:px-4 md:py-3 md:text-left ${
                active ? 'bg-qx-green text-white' : 'bg-[#222A39] text-qx-textDim hover:bg-[#30394B]'
              }`}
            >
              <div className="flex flex-col items-center gap-1.5 md:hidden">
                <span className={active ? 'text-white' : 'text-qx-textDim'}>{CAT_ICONS[c.id]}</span>
                <span className="text-[11px] font-extrabold tracking-wide text-white">{c.label}</span>
              </div>
              <div className="hidden flex-col gap-2 md:flex">
                <div>
                  <div className="text-sm font-extrabold tracking-wide text-white">{c.label}</div>
                  <div className={`text-xs ${active ? 'text-white/85' : 'text-qx-textMute'}`}>{items.length} methods</div>
                </div>
                <div className="flex items-center -space-x-1.5">
                  {items.slice(0, 5).map((m, i) => (
                    <PaymentLogo key={i} name={m.name} logo={m.logo} size={22} />
                  ))}
                  {items.length > 5 && (
                    <span className={`flex h-[22px] min-w-[22px] items-center justify-center rounded-full px-1 text-[10px] font-bold ${active ? 'bg-black/25 text-white' : 'bg-qx-panel2 text-qx-textDim'}`}>
                      +{items.length - 5}
                    </span>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto pr-0.5">
        {sections.map((sec) => (
          <div key={sec.id} className="mb-5">
            <h3 className="mb-3 text-lg font-bold text-white">
              {GROUP_TITLES[sec.id]} ({sec.items.length})
            </h3>
            <div className="grid min-w-0 gap-2.5 sm:grid-cols-2">
              {sec.items.map((m, i) => (
                <button
                  key={`${sec.id}-${i}`}
                  onClick={() => onPick(m)}
                  className="flex w-full min-w-0 items-center gap-2.5 rounded-xl bg-white px-3 py-2.5 text-left transition hover:brightness-95"
                >
                  <PaymentLogo name={m.name} logo={m.logo} size={34} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-semibold text-[#1B2433]">{m.name}</div>
                    <div className="text-xs text-[#7A8699]">Min. ${(m.minAmount || minDeposit).toFixed(2)}</div>
                  </div>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9AA4B5" strokeWidth="2.2" className="shrink-0">
                    <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function DepositForm({ method, minDeposit, onClose, onChangeMethod }) {
  const pushToast = useStore((s) => s.pushToast)
  const min = method.minAmount || minDeposit || 10
  const max = method.maxAmount || 50000
  const [amountStr, setAmountStr] = useState(String(Math.max(min, 100)))
  const amount = Number(amountStr) || 0
  const [senderNumber, setSenderNumber] = useState('')
  const [file, setFile] = useState(null)
  const [bonusOpen, setBonusOpen] = useState(true)
  const [bonusCode, setBonusCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const bonus = bonusFor(amount, bonusCode)
  const bonusAmt = bonus.bonus || 0
  const totalCredit = amount + bonusAmt
  const cleanCode = normalizeCode(bonusCode)

  function onAmountChange(v) {
    v = v.replace(/[^\d.]/g, '')
    const parts = v.split('.')
    if (parts.length > 2) v = parts[0] + '.' + parts.slice(1).join('')
    v = v.replace(/^0+(?=\d)/, '')
    setAmountStr(v)
  }

  function applyCode(code) {
    setBonusCode(normalizeCode(code))
  }

  async function submit() {
    if (amount < min) {
      pushToast({ type: 'loss', title: 'Amount too low', msg: `Minimum is $${min.toFixed(2)}.` })
      return
    }
    if (amount > max) {
      pushToast({ type: 'loss', title: 'Amount too high', msg: `Maximum is $${max.toLocaleString()}.` })
      return
    }
    if (cleanCode && !bonus.valid) {
      pushToast({ type: 'loss', title: 'Bonus not applied', msg: 'Code is invalid or amount is below the required minimum.' })
      return
    }
    setBusy(true)
    try {
      let screenshotPath = ''
      if (file) {
        const fd = new FormData()
        fd.append('file', file)
        const up = await fetch('/api/upload', { method: 'POST', body: fd })
        const upd = await up.json()
        if (up.ok) screenshotPath = upd.path
      }
      const res = await fetch('/api/deposits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: method.name, amount, bonusCode: cleanCode, senderNumber, screenshotPath }),
      })
      const data = await res.json()
      if (!res.ok) {
        pushToast({ type: 'loss', title: 'Deposit failed', msg: data.error })
      } else {
        setDone(true)
        pushToast({ type: 'win', title: 'Request submitted', msg: 'Awaiting admin approval.' })
      }
    } catch {
      pushToast({ type: 'loss', title: 'Network error', msg: 'Try again.' })
    }
    setBusy(false)
  }

  if (done) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="mb-3 text-5xl">⏳</div>
        <p className="text-lg font-semibold text-white">Deposit request submitted</p>
        <p className="mt-1 text-sm text-qx-textDim">Admin approval ke baad real balance credit ho jayega.</p>
        {bonus.valid && (
          <p className="mt-2 text-sm font-semibold text-qx-green">
            {bonus.code} applied: +{bonus.pct}% bonus — total ${totalCredit.toFixed(2)} on approval.
          </p>
        )}
        <button onClick={onClose} className="qx-btn-green mt-6 px-8">Done</button>
      </div>
    )
  }

  const presets = [150, 200, 300, 500].filter((x) => x >= min && x <= max)
  const dest =
    method.type === 'crypto'
      ? method.walletAddress
      : method.type === 'bank'
      ? `${method.accountTitle || ''} ${method.accountNumber ? '— ' + method.accountNumber : ''}`.trim()
      : `${method.number || ''} ${method.accountTitle ? '(' + method.accountTitle + ')' : ''}`.trim()

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-4 py-5 md:px-7">
      <div className="rounded-lg bg-white text-[#2B3344] shadow-panel">
        <div className="flex items-center gap-4 px-5 py-4">
          <PaymentLogo name={method.name} logo={method.logo} size={42} />
          <div className="min-w-0 flex-1 truncate text-xl font-semibold">{method.name}</div>
          <button onClick={onChangeMethod} className="text-sm font-extrabold uppercase text-[#177DDC]">Change</button>
        </div>
        <div className="border-t border-dashed border-[#D6DCE7] px-5 py-3 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-[#9AA4B5]">Min amount:</span>
            <b>${min.toFixed(2)}</b>
          </div>
          <div className="mt-1 flex items-center justify-between gap-4">
            <span className="text-[#9AA4B5]">Max amount:</span>
            <b>${max.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-lg bg-[#4A3C3C] px-4 py-3 text-sm text-white">
        <b className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#FF9F1A] text-white">!</b>
        <b>Minimum amount – {min} $.</b> Smaller payments won&apos;t be credited.
      </div>

      <div className="relative mt-4 rounded-lg border border-[#657086] px-4 pb-3 pt-4">
        <span className="absolute -top-3 left-5 bg-[#2B3344] px-2 text-sm text-qx-textMute">Deposit amount</span>
        <input
          type="text"
          inputMode="decimal"
          value={amountStr}
          onChange={(e) => onAmountChange(e.target.value)}
          className="w-full bg-transparent text-3xl text-white outline-none"
          placeholder="100"
        />
        <span className="absolute right-5 top-5 text-2xl text-qx-textDim">$</span>
      </div>

      <div className="mt-2 grid grid-cols-4 gap-2">
        {presets.map((v) => (
          <button key={v} onClick={() => setAmountStr(String(v))} className="rounded-lg bg-[#3A4356] py-3 text-lg font-extrabold text-white hover:bg-[#465168]">
            {v} $
          </button>
        ))}
      </div>

      <div className="mt-5 rounded-xl border border-[#3C465A] bg-[#222A39]">
        <button onClick={() => setBonusOpen((o) => !o)} className="flex w-full items-center justify-between px-5 py-4 text-left">
          <span className="flex items-center gap-3 text-xl font-extrabold text-white">
            <span className="text-2xl">🎟️</span> Bonus Code
          </span>
          <span className={`text-3xl text-[#177DDC] transition ${bonusOpen ? 'rotate-180' : ''}`}>⌃</span>
        </button>
        {bonusOpen && (
          <div className="px-5 pb-5">
            <div className="relative rounded-lg border border-white bg-[#202838] px-4 py-3">
              <span className="absolute -top-3 left-5 bg-[#222A39] px-2 text-sm text-qx-textMute">Your promo code</span>
              <div className="flex items-center gap-3">
                <span className="text-2xl">🎫</span>
                <input
                  value={bonusCode}
                  onChange={(e) => setBonusCode(e.target.value.toUpperCase())}
                  placeholder="Select or enter code"
                  className="min-w-0 flex-1 bg-transparent text-xl text-white outline-none placeholder:text-qx-textMute"
                />
                <button onClick={() => applyCode(bonusCode)} className="border-l border-white/10 pl-5 font-bold text-[#177DDC]">Apply</button>
              </div>
            </div>
            <div className="overflow-hidden rounded-b-lg bg-[#535C70]">
              {BONUS_CODES.map((b) => {
                const active = cleanCode === b.code
                const locked = amount < b.min
                return (
                  <button key={b.code} onClick={() => applyCode(b.code)} className={`w-full border-b border-white/5 px-5 py-4 text-left last:border-b-0 ${active ? 'bg-[#606C84]' : 'hover:bg-[#5C667C]'}`}>
                    <div className="font-extrabold text-white">{b.code}</div>
                    <div className={`text-sm font-bold ${locked ? 'text-white/60' : 'text-white'}`}>{b.title}</div>
                  </button>
                )
              })}
            </div>
            {cleanCode && (
              <div className={`mt-3 rounded-lg px-3 py-2 text-sm ${bonus.valid ? 'bg-qx-green/15 text-qx-green' : 'bg-qx-red/15 text-qx-red'}`}>
                {bonus.valid ? `${bonus.code} applied: +$${bonusAmt.toFixed(2)} bonus, total credit $${totalCredit.toFixed(2)}.` : 'Code selected, but amount is below minimum or code is invalid.'}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-5 space-y-3">
        <div className="rounded-xl bg-[#222A39] p-4 text-sm">
          <p className="text-qx-textDim">Send payment to:</p>
          <p className="mt-1 break-all font-semibold text-white">{dest || 'Admin will provide payment details.'}</p>
        </div>
        <input value={senderNumber} onChange={(e) => setSenderNumber(e.target.value)} placeholder="03123456789" className="qx-input" />
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="block w-full text-sm text-qx-textDim file:mr-3 file:rounded-md file:border-0 file:bg-qx-panel2 file:px-3 file:py-2 file:text-white"
        />
      </div>

      <div className="mt-5 rounded-lg bg-[#4A3C3C] px-4 py-3 text-sm text-white">
        <b className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#FF9F1A] text-white">!</b>
        Payments with this method can take up to 48 hours to process. If it&apos;s not on your balance by that time, submit a support ticket.
      </div>

      <button onClick={submit} disabled={busy} className="mt-5 w-full rounded-lg bg-[#0F83D8] py-4 text-xl font-extrabold text-white transition hover:brightness-110 disabled:opacity-60">
        {busy ? 'Submitting…' : 'Proceed to Pay'}
      </button>
    </div>
  )
}
