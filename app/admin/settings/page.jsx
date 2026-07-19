'use client'
import { useEffect, useState } from 'react'
import PaymentLogo from '@/components/trade/PaymentLogo'

const TYPES = [
  { value: 'mobile', label: 'E-Pay (wallet)' },
  { value: 'bank', label: 'Bank' },
  { value: 'crypto', label: 'Crypto' },
]
const LOGOS = ['', 'jazzcash', 'easypaisa', 'binance', 'cashmaal', 'usdt', 'btc', 'eth', 'visa', 'bank']

export default function AdminSettings() {
  const [settings, setSettings] = useState(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetch('/api/admin/settings')
      .then((r) => r.json())
      .then((d) => !d.error && setSettings(d))
  }, [])

  function updateMethod(i, patch) {
    setSettings((s) => {
      const methods = s.methods.map((m, idx) => (idx === i ? { ...m, ...patch } : m))
      return { ...s, methods }
    })
  }
  function addMethod() {
    setSettings((s) => ({
      ...s,
      methods: [...s.methods, { name: 'New method', type: 'mobile', isEnabled: false, popular: false, minAmount: 10, logo: '' }],
    }))
  }
  function removeMethod(i) {
    setSettings((s) => ({ ...s, methods: s.methods.filter((_, idx) => idx !== i) }))
  }

  async function save(body) {
    setSaving(true)
    setMsg('')
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || settings),
    })
    setSaving(false)
    setMsg(res.ok ? 'Saved ✓' : 'Save failed')
    setTimeout(() => setMsg(''), 2500)
    if (res.ok && body?.action === 'resetMethods') {
      const d = await fetch('/api/admin/settings').then((r) => r.json())
      if (!d.error) setSettings(d)
    }
  }

  if (!settings) return <p className="text-qx-textDim">Loading…</p>

  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Payment settings</h1>
        <button
          onClick={() => confirm('Replace all payment methods with the defaults?') && save({ action: 'resetMethods' })}
          className="rounded-lg bg-qx-panel2 px-3 py-2 text-xs font-bold text-white hover:bg-qx-border"
        >
          Reset to defaults
        </button>
      </div>

      <div className="space-y-4">
        {settings.methods.map((m, i) => (
          <div key={i} className="qx-card p-4">
            <div className="mb-3 flex items-center gap-3">
              <PaymentLogo name={m.name} logo={m.logo} size={34} />
              <input
                value={m.name}
                onChange={(e) => updateMethod(i, { name: e.target.value })}
                className="qx-input flex-1 font-bold"
              />
              <button
                onClick={() => updateMethod(i, { isEnabled: !m.isEnabled })}
                className={`relative h-6 w-11 shrink-0 rounded-full transition ${m.isEnabled ? 'bg-qx-green' : 'bg-qx-panel2'}`}
                title={m.isEnabled ? 'Enabled' : 'Disabled'}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${m.isEnabled ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
              <button onClick={() => removeMethod(i)} className="shrink-0 rounded-md bg-qx-red/80 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-qx-red">
                Remove
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-sm">
                <span className="qx-label">Category</span>
                <select value={m.type} onChange={(e) => updateMethod(i, { type: e.target.value })} className="qx-input">
                  {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </label>
              <label className="text-sm">
                <span className="qx-label">Logo</span>
                <select value={m.logo || ''} onChange={(e) => updateMethod(i, { logo: e.target.value })} className="qx-input">
                  {LOGOS.map((l) => <option key={l} value={l}>{l || 'auto'}</option>)}
                </select>
              </label>
              <Num label="Min amount" value={m.minAmount} onChange={(v) => updateMethod(i, { minAmount: v })} />
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {m.type === 'crypto' ? (
                <Field label="Wallet address" value={m.walletAddress} onChange={(v) => updateMethod(i, { walletAddress: v })} full />
              ) : m.type === 'bank' ? (
                <>
                  <Field label="Account title" value={m.accountTitle} onChange={(v) => updateMethod(i, { accountTitle: v })} />
                  <Field label="Account number" value={m.accountNumber} onChange={(v) => updateMethod(i, { accountNumber: v })} />
                </>
              ) : (
                <>
                  <Field label="Number" value={m.number} onChange={(v) => updateMethod(i, { number: v })} />
                  <Field label="Account title" value={m.accountTitle} onChange={(v) => updateMethod(i, { accountTitle: v })} />
                </>
              )}
            </div>

            <label className="mt-3 flex w-fit cursor-pointer items-center gap-2 text-sm text-qx-textDim">
              <input type="checkbox" checked={!!m.popular} onChange={(e) => updateMethod(i, { popular: e.target.checked })} />
              Show in “Popular in your region”
            </label>
          </div>
        ))}

        <button onClick={addMethod} className="w-full rounded-lg border border-dashed border-qx-border py-3 text-sm font-bold text-qx-textDim hover:text-white">
          + Add payment method
        </button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Num label="Min deposit (global fallback)" value={settings.minDeposit} onChange={(v) => setSettings((s) => ({ ...s, minDeposit: v }))} />
        <Num label="Min withdrawal" value={settings.minWithdrawal} onChange={(v) => setSettings((s) => ({ ...s, minWithdrawal: v }))} />
      </div>

      <div className="mt-4">
        <label className="qx-label">Site announcement (shown on trade page)</label>
        <textarea
          value={settings.announcement}
          onChange={(e) => setSettings((s) => ({ ...s, announcement: e.target.value }))}
          rows={2}
          className="qx-input"
          placeholder="e.g. Weekend bonus: +20% on deposits!"
        />
      </div>

      <div className="mt-6 flex items-center gap-4">
        <button onClick={() => save()} disabled={saving} className="qx-btn-green">
          {saving ? 'Saving…' : 'Save settings'}
        </button>
        {msg && <span className="text-sm text-qx-green">{msg}</span>}
      </div>
    </div>
  )
}

function Field({ label, value, onChange, full }) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <label className="qx-label">{label}</label>
      <input value={value || ''} onChange={(e) => onChange(e.target.value)} className="qx-input" />
    </div>
  )
}
function Num({ label, value, onChange }) {
  return (
    <div>
      <label className="qx-label">{label}</label>
      <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} className="qx-input" />
    </div>
  )
}
