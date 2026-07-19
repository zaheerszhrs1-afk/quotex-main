'use client'
import { useState } from 'react'
import { useStore } from '@/lib/store'
import { getSocket } from '@/lib/socketClient'
import AssetIcon from './AssetIcon'

// Duration ladder (must be a subset of the server's ALLOWED_DURATIONS)
const DURATIONS = [5, 10, 15, 30, 60, 120, 300, 900, 1800, 3600]
const QUICK_ADD = [1, 5, 10, 100]

function fmtDur(sec) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  const p = (n) => String(n).padStart(2, '0')
  return `${p(h)}:${p(m)}:${p(s)}`
}

export default function TradePanel({ mobile = false, onPickAsset }) {
  const symbol = useStore((s) => s.activeSymbol)
  const summary = useStore((s) => s.summary[symbol])
  const accountType = useStore((s) => s.accountType)
  const balance = useStore((s) => s.balance)
  const me = useStore((s) => s.me)
  const addOpenTrade = useStore((s) => s.addOpenTrade)
  const pushToast = useStore((s) => s.pushToast)
  const setTradeNotice = useStore((s) => s.setTradeNotice)

  const [durIdx, setDurIdx] = useState(4) // 60s
  const [amount, setAmount] = useState(1)
  const [pending, setPending] = useState(false)
  const [showQuick, setShowQuick] = useState(false)
  const [busy, setBusy] = useState(false)

  const duration = DURATIONS[durIdx]
  const payout = summary?.payout ?? 80
  const profit = (amount * payout) / 100
  const curBalance = accountType === 'real' ? balance.realBalance : balance.demoBalance

  const stepDur = (d) => setDurIdx((i) => Math.min(Math.max(i + d, 0), DURATIONS.length - 1))
  const stepAmt = (d) => setAmount((a) => Math.max(1, Math.round(a + d)))

  async function trade(direction) {
    if (!me) {
      pushToast({ type: 'loss', title: 'Login required', msg: 'Please log in to trade.' })
      return
    }
    if (amount > curBalance) {
      pushToast({ type: 'loss', title: 'Insufficient balance', msg: `You only have $${curBalance.toFixed(2)}.` })
      return
    }
    setBusy(true)
    const sock = await getSocket()
    sock.emit('open_trade', { symbol, direction, amount, duration, accountType }, (resp) => {
      setBusy(false)
      if (resp?.error) {
        pushToast({ type: 'loss', title: 'Trade failed', msg: resp.error })
        return
      }
      if (resp?.trade) {
        addOpenTrade(resp.trade)
        setTradeNotice({
          symbol: resp.trade.symbol,
          openPrice: resp.trade.openPrice,
          digits: 3,
          direction: resp.trade.direction,
        })
      }
    })
  }

  const Toggle = (
    <button
      onClick={() => setPending((p) => !p)}
      className={`relative h-5 w-9 rounded-full transition ${pending ? 'bg-[#2F8FEE]' : 'bg-qx-panel2'}`}
    >
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${pending ? 'left-[18px]' : 'left-0.5'}`} />
    </button>
  )

  // ----- compact mobile layout (inline at the bottom of the screen) -----
  if (mobile) {
    return (
      <div className="flex flex-col gap-1.5 bg-qx-panel px-3 py-2">
        {/* asset + pending toggle */}
        <div className="flex items-center justify-between">
          <button onClick={onPickAsset} className="flex items-center gap-1.5">
            <AssetIcon symbol={symbol} size={20} />
            <span className="text-sm font-bold text-white">{symbol}</span>
            <span className="text-sm font-extrabold text-qx-textDim">{payout}%</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-qx-textDim">
              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[#5B9BFF]">Pending trade</span>
            {Toggle}
          </div>
        </div>

        {/* Time + Investment side by side */}
        <div className="grid grid-cols-2 gap-2">
          <Control label="Time" compact onMinus={() => stepDur(-1)} onPlus={() => stepDur(1)} value={fmtDur(duration)} />
          <div>
            <Control
              label="Investment"
              compact
              onMinus={() => stepAmt(-1)}
              onPlus={() => stepAmt(1)}
              value={`${amount} $`}
              editable
              onChange={(v) => setAmount(Math.max(1, Math.round(Number(v) || 0)))}
              sub="SWITCH"
              onSub={() => setShowQuick((q) => !q)}
            />
            {showQuick && (
              <div className="mt-1 grid grid-cols-4 gap-1">
                {QUICK_ADD.map((q) => (
                  <button key={q} onClick={() => stepAmt(q)} className="rounded-md bg-qx-panel2 py-1 text-[11px] font-semibold text-white hover:bg-qx-border">+{q}</button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* payout */}
        <div className="flex items-end gap-2">
          <span className="text-xs text-qx-textDim">Payout</span>
          <span className="mb-1 flex-1 border-b border-dotted border-qx-border" />
          <span className="text-sm font-bold text-white">{(amount + profit).toFixed(2)} $</span>
        </div>

        {/* Up / Down side by side */}
        <div className="grid grid-cols-2 gap-2">
          <button disabled={busy} onClick={() => trade('up')}
            className="flex items-center justify-between rounded-lg bg-qx-green px-4 py-2 text-base font-bold text-white transition hover:bg-qx-greenHover active:scale-[0.99] disabled:opacity-60">
            Up
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/25">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 19V5M6 11l6-6 6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
          </button>
          <button disabled={busy} onClick={() => trade('down')}
            className="flex items-center justify-between rounded-lg bg-qx-red px-4 py-2 text-base font-bold text-white transition hover:bg-qx-redHover active:scale-[0.99] disabled:opacity-60">
            Down
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/25">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 5v14M6 13l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="m-2 flex flex-col gap-2.5 rounded-2xl border border-qx-border bg-qx-panel p-3 shadow-panel">
      {/* asset + payout */}
      <div className="flex items-center justify-between">
        <button
          onClick={onPickAsset}
          className="flex items-center gap-2 rounded-md py-0.5 transition hover:opacity-80"
        >
          <AssetIcon symbol={symbol} size={22} />
          <span className="text-base font-bold text-white">{symbol}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-qx-textDim">
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="text-2xl font-extrabold text-qx-textDim">{payout}%</span>
      </div>

      {/* pending trade toggle */}
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#5B9BFF]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" strokeLinecap="round" />
          </svg>
          Pending trade
        </span>
        <button
          onClick={() => setPending((p) => !p)}
          className={`relative h-5 w-9 rounded-full transition ${pending ? 'bg-[#2F8FEE]' : 'bg-qx-panel2'}`}
        >
          <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${pending ? 'left-[18px]' : 'left-0.5'}`} />
        </button>
      </div>

      {/* Time control */}
      <Control label="Time" onMinus={() => stepDur(-1)} onPlus={() => stepDur(1)} value={fmtDur(duration)} sub="SWITCH TIME" />

      {/* Investment control */}
      <div>
        <Control
          label="Investment"
          onMinus={() => stepAmt(-1)}
          onPlus={() => stepAmt(1)}
          value={`${amount} $`}
          editable
          onChange={(v) => setAmount(Math.max(1, Math.round(Number(v) || 0)))}
          sub="SWITCH"
          onSub={() => setShowQuick((q) => !q)}
        />
        {showQuick && (
          <div className="mt-2 grid grid-cols-4 gap-2">
            {QUICK_ADD.map((q) => (
              <button key={q} onClick={() => stepAmt(q)} className="rounded-md bg-qx-panel2 py-1.5 text-xs font-semibold text-white hover:bg-qx-border">
                +{q}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* payout + investment summary */}
      <div className="space-y-1.5">
        <div className="flex items-end gap-2">
          <span className="text-sm text-qx-textDim">Payout</span>
          <span className="mb-1 flex-1 border-b border-dotted border-qx-border" />
          <span className="text-base font-bold text-white">{(amount + profit).toFixed(2)} $</span>
        </div>
        <div className="flex items-end gap-2">
          <span className="text-sm text-qx-textDim">Investment</span>
          <span className="mb-1 flex-1 border-b border-dotted border-qx-border" />
          <span className="text-base font-bold text-white">{amount.toFixed(2)} $</span>
        </div>
      </div>

      {/* Up / Down */}
      <div className="space-y-2">
        <button
          disabled={busy}
          onClick={() => trade('up')}
          className="flex w-full items-center justify-between rounded-lg bg-qx-green px-5 py-2.5 text-lg font-bold text-white transition hover:bg-qx-greenHover active:scale-[0.99] disabled:opacity-60"
        >
          Up
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/25">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M12 19V5M6 11l6-6 6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </button>
        <button
          disabled={busy}
          onClick={() => trade('down')}
          className="flex w-full items-center justify-between rounded-lg bg-qx-red px-5 py-2.5 text-lg font-bold text-white transition hover:bg-qx-redHover active:scale-[0.99] disabled:opacity-60"
        >
          Down
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/25">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M12 5v14M6 13l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </button>
      </div>
    </div>
  )
}

function Control({ label, value, onMinus, onPlus, sub, onSub, editable, onChange, compact }) {
  const btn = compact ? 'px-2.5 py-2 text-lg' : 'px-4 py-2 text-xl'
  const val = compact ? 'text-base' : 'text-lg'
  return (
    <div>
      <div className="relative rounded-lg border border-qx-border bg-qx-input">
        <span className="absolute -top-2 left-3 bg-qx-panel px-1 text-[11px] text-qx-textDim">{label}</span>
        <div className="flex items-center">
          <button onClick={onMinus} className={`${btn} text-qx-textDim hover:text-white`}>−</button>
          {editable ? (
            <input
              value={value.replace(' $', '')}
              onChange={(e) => onChange(e.target.value)}
              className={`w-full bg-transparent text-center ${val} font-bold text-white outline-none`}
            />
          ) : (
            <div className={`flex-1 text-center ${val} font-bold text-white`}>{value}</div>
          )}
          <button onClick={onPlus} className={`${btn} text-qx-textDim hover:text-white`}>+</button>
        </div>
      </div>
      {sub && (
        <button
          onClick={onSub}
          className="mx-auto mt-1 block text-center text-[11px] font-bold uppercase tracking-wide text-[#5B9BFF] hover:underline"
        >
          {sub}
        </button>
      )}
    </div>
  )
}
