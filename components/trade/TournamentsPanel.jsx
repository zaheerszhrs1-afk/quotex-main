'use client'
import { useEffect, useState, useCallback } from 'react'

// Tournaments section (Account → Tournaments), a faithful clone of the Quotex
// flow: a list of cards (Active / Completed), a detail page with the live
// leaderboard + FAQ, and a "Confirm your participation" modal that gates joining
// behind having deposited a real account at least once.

const FAQ = [
  ['What is a tournament?', 'A tournament is a competition where traders start with the same balance and compete to grow it the most within a set time. The traders with the highest balances at the end share the prize pool.'],
  ['What is the price of entering a tournament?', 'Some tournaments are free to enter, while others have an entry fee shown on the tournament card. Free tournaments require at least one real-account deposit to participate.'],
  ['How a winner is determined?', 'Winners are ranked by their tournament account balance when the tournament ends. Prizes are distributed from the top of the leaderboard down.'],
  ['What are the reasons for disqualification?', 'Using multiple accounts, abusing bonuses, or any activity that violates the platform rules can lead to disqualification.'],
  ['Are there free tournaments?', 'Yes. Free tournaments have a 0$ entry fee — you only need to have deposited a real account at least once to join.'],
  ['What is a rebuy?', 'A rebuy lets you reset your tournament balance to the starting amount for a small fee if you run out, giving you another chance to climb the leaderboard.'],
  ['If I win, when will I get the money?', 'Prizes are credited to your real account balance shortly after the tournament ends and results are finalised.'],
]

function durationLabel(start, end) {
  const ms = new Date(end).getTime() - new Date(start).getTime()
  const days = Math.round(ms / 86400000)
  if (days >= 1) return `${days} day${days > 1 ? 's' : ''}`
  const hrs = Math.max(1, Math.round(ms / 3600000))
  return `${hrs} hour${hrs > 1 ? 's' : ''}`
}

// "07:14:27" when the start is < 24h away, otherwise "4 DAY(S)"
function untilStart(start) {
  const diff = new Date(start).getTime() - Date.now()
  if (diff <= 0) return null
  const days = Math.floor(diff / 86400000)
  if (days >= 1) return `${days} DAY(S)`
  const s = Math.floor(diff / 1000)
  const p = (n) => String(n).padStart(2, '0')
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`
}

const fmtUTC = (d) =>
  new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })

export default function TournamentsPanel({ onDeposit }) {
  const [view, setView] = useState('list') // 'list' | id
  const [tab, setTab] = useState('active') // 'active' | 'completed'
  const [data, setData] = useState(null) // { tournaments, hasDeposited }
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/tournaments')
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData({ tournaments: [], hasDeposited: false }))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // live tick so countdowns/“active now” update
  const [, setNow] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setNow((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])

  if (view !== 'list') {
    return (
      <TournamentDetail
        id={view}
        hasDeposited={data?.hasDeposited}
        onBack={() => { setView('list'); load() }}
        onDeposit={onDeposit}
        onJoined={load}
      />
    )
  }

  const all = data?.tournaments || []
  const list = all.filter((t) => (tab === 'completed' ? t.status === 'completed' : t.status !== 'completed'))

  return (
    <div className="mt-3">
      <div className="mb-1 text-lg font-bold text-white">Tournaments</div>

      {/* Active / Completed tabs */}
      <div className="flex gap-6 border-b border-qx-border">
        {[['active', 'Active'], ['completed', 'Completed']].map(([id, label]) => {
          const n = all.filter((t) => (id === 'completed' ? t.status === 'completed' : t.status !== 'completed')).length
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 pb-3 pt-2 text-[15px] font-bold uppercase tracking-wide transition ${
                tab === id ? 'border-[#2F8FEE] text-[#5B9BFF]' : 'border-transparent text-qx-textDim hover:text-white'
              }`}
            >
              {label}
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#2F8FEE] px-1.5 text-[11px] text-white">{n}</span>
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="py-20 text-center text-sm text-qx-textMute">Loading…</div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="text-lg font-bold text-white">No tournaments</div>
          <div className="mt-1 text-sm text-qx-textMute">
            {tab === 'completed' ? 'No completed tournaments yet.' : 'There are no active tournaments right now.'}
          </div>
        </div>
      ) : (
        <>
          <div className="py-6 text-center text-lg font-bold text-white">
            {tab === 'completed' ? `Completed (${list.length})` : `Available for participation (${list.length})`}
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            {list.map((t) => (
              <TournamentCard key={t.id} t={t} onDetails={() => setView(t.id)} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function StatusBadge({ t }) {
  if (t.status === 'completed') {
    return <Badge className="bg-qx-panel2 text-qx-textDim">COMPLETED</Badge>
  }
  if (t.status === 'active') {
    return <Badge className="bg-qx-green text-white">ACTIVE NOW</Badge>
  }
  return (
    <Badge className="bg-[#2F8FEE] text-white">
      <ClockIcon /> UNTIL START: {untilStart(t.startTime)}
    </Badge>
  )
}
function Badge({ children, className }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold ${className}`}>{children}</span>
}
function ClockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" strokeLinecap="round" />
    </svg>
  )
}

// faint trophy/skyline watermark behind the card, like the real cards
function CardArt() {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.06]" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" fill="white">
      <path d="M120 200V90l40-30 40 30v110zM200 200V70l40-30 40 30v130zM60 200v-70l40-25 40 25v70z" />
    </svg>
  )
}

function TournamentCard({ t, onDetails }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-qx-panel2 p-5">
      <CardArt />
      <div className="relative">
        <div className="flex items-start justify-between">
          <StatusBadge t={t} />
          <div className="text-right">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-qx-textDim">Prize pool</div>
            <div className="text-2xl font-extrabold text-qx-green">{t.prizePool} $</div>
          </div>
        </div>

        <div className="mt-6 text-3xl font-extrabold text-white">{t.name}</div>

        <div className="mt-6 flex items-stretch divide-x divide-qx-border rounded-xl bg-black/15">
          <Stat value={`${t.entryFee || 0} $`} label="Entry fee" />
          <Stat value={durationLabel(t.startTime, t.endTime)} label="Duration" />
        </div>

        <button
          onClick={onDetails}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-qx-panel py-3 text-sm font-bold text-white transition hover:bg-qx-border"
        >
          Details
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#2F8FEE] text-[11px]">i</span>
        </button>
      </div>
    </div>
  )
}
function Stat({ value, label }) {
  return (
    <div className="flex flex-1 flex-col items-center py-4">
      <div className="text-xl font-extrabold text-white">{value}</div>
      <div className="mt-1 text-xs text-qx-textDim">{label}</div>
    </div>
  )
}

/* ------------------------------- Detail ------------------------------- */

function TournamentDetail({ id, hasDeposited: hasDepInit, onBack, onDeposit, onJoined }) {
  const [d, setD] = useState(null)
  const [loading, setLoading] = useState(true)
  const [confirm, setConfirm] = useState(false)
  const [openFaq, setOpenFaq] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/tournaments/${id}`)
      .then((r) => r.json())
      .then((res) => setD(res))
      .catch(() => setD(null))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <div className="py-20 text-center text-sm text-qx-textMute">Loading…</div>
  if (!d?.tournament) return (
    <div className="mt-3">
      <BackLink onBack={onBack} />
      <div className="py-24 text-center text-qx-textMute">Tournament not found.</div>
    </div>
  )

  const t = d.tournament
  const hasDeposited = d.hasDeposited ?? hasDepInit
  const canJoin = t.status !== 'completed' && !t.joined

  return (
    <div className="mt-3">
      <BackLink onBack={onBack} />

      <div className="mt-4 grid gap-6 lg:grid-cols-[1.1fr_1fr_0.9fr]">
        {/* hero + meta */}
        <div>
          <div className="relative overflow-hidden rounded-2xl bg-qx-panel2 p-6">
            <CardArt />
            <div className="relative">
              <StatusBadge t={t} />
              <div className="mt-2 flex items-start justify-between gap-3">
                <div className="text-4xl font-extrabold leading-tight text-white">{t.name}</div>
                <div className="text-right">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-qx-textDim">Prize pool</div>
                  <div className="text-2xl font-extrabold text-qx-green">{t.prizePool} $</div>
                </div>
              </div>

              {t.joined ? (
                <div className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-qx-green/15 py-3.5 text-base font-bold text-qx-green">
                  ✓ You are participating
                </div>
              ) : t.status === 'completed' ? (
                <div className="mt-6 rounded-xl bg-qx-panel py-3.5 text-center text-base font-bold text-qx-textDim">
                  Tournament ended
                </div>
              ) : (
                <button
                  onClick={() => setConfirm(true)}
                  className="mt-6 w-full rounded-xl bg-qx-green py-3.5 text-base font-bold text-white transition hover:bg-qx-greenHover"
                >
                  Join now — {t.entryFee || 0}$
                </button>
              )}
            </div>
          </div>

          {/* meta grid */}
          <div className="mt-5 grid grid-cols-2 gap-y-6 sm:grid-cols-4">
            <Meta top="UTC+00:00" value={fmtUTC(t.startTime)} label="START" />
            <Meta value={`${t.prizePool}$`} label="PRIZE POOL" />
            <Meta value={`${t.entryFee || 0}$`} label="ENTRY FEE" />
            <Meta value={`${t.rebuyCost.toFixed(2)}$`} label="REBUY COST" />
            <Meta top="UTC+00:00" value={fmtUTC(t.endTime)} label="END" />
            <Meta value={t.rebuys} label="NUMBER OF REBUYS" />
            <Meta value={durationLabel(t.startTime, t.endTime)} label="DURATION" />
          </div>
        </div>

        {/* leaderboard */}
        <div className="lg:border-l lg:border-qx-border lg:pl-6">
          <div className="grid grid-cols-[28px_1fr_auto_auto] items-center gap-2 border-b border-qx-border pb-2 text-xs font-semibold uppercase tracking-wide text-qx-textMute">
            <span>#</span><span>Participant</span><span className="text-right">Balance</span><span className="pl-4 text-right">Prize</span>
          </div>
          <div className="max-h-[520px] divide-y divide-qx-border/40 overflow-y-auto">
            {d.leaderboard.map((p) => (
              <div key={p.rank} className={`grid grid-cols-[28px_1fr_auto_auto] items-center gap-2 py-2.5 text-sm ${p.isMe ? 'bg-qx-green/10' : ''}`}>
                <span className="font-semibold text-qx-textDim">{p.rank}</span>
                <span className="flex min-w-0 items-center gap-2">
                  <span className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-qx-panel2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7E8A99" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M4 20a8 8 0 0116 0" strokeLinecap="round" /></svg>
                    {p.cc && (
                      <img
                        src={`https://flagcdn.com/w20/${p.cc}.png`}
                        alt=""
                        loading="lazy"
                        className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full object-cover ring-1 ring-qx-panel"
                      />
                    )}
                  </span>
                  <span className="truncate font-semibold text-white">{p.isMe ? 'You' : p.name}</span>
                </span>
                <span className="text-right font-bold tabular-nums text-white">{p.balance.toLocaleString()}$</span>
                <span className={`pl-4 text-right font-bold tabular-nums ${p.prize ? 'text-qx-green' : 'text-qx-textMute'}`}>{p.prize}$</span>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="lg:border-l lg:border-qx-border lg:pl-6">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-lg font-bold text-white">FAQ</span>
          </div>
          <div className="divide-y divide-qx-border/60">
            {FAQ.map(([q, a], i) => (
              <div key={i} className="py-3">
                <button onClick={() => setOpenFaq((o) => (o === i ? null : i))} className="flex w-full items-center justify-between gap-3 text-left">
                  <span className="text-sm font-semibold text-white">{q}</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7E8A99" strokeWidth="2" className={`shrink-0 transition ${openFaq === i ? 'rotate-180' : ''}`}><path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
                {openFaq === i && <p className="mt-2 text-sm leading-relaxed text-qx-textDim">{a}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {confirm && (
        <ConfirmModal
          t={t}
          hasDeposited={hasDeposited}
          onClose={() => setConfirm(false)}
          onDeposit={() => { setConfirm(false); onDeposit?.() }}
          onJoined={() => { setConfirm(false); load(); onJoined?.() }}
        />
      )}
    </div>
  )
}

function BackLink({ onBack }) {
  return (
    <button onClick={onBack} className="flex items-center gap-2 text-[15px] font-bold text-[#5B9BFF] hover:underline">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#2F8FEE] text-white">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </span>
      Return back
    </button>
  )
}

function Meta({ top, value, label }) {
  return (
    <div className="leading-tight">
      {top && <div className="text-[11px] text-qx-textMute">{top}</div>}
      <div className="text-base font-bold text-white">{value}</div>
      <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-qx-textMute">{label}</div>
    </div>
  )
}

/* --------------------------- Confirm modal --------------------------- */

function ConfirmModal({ t, hasDeposited, onClose, onDeposit, onJoined }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // free tournaments require a prior real deposit; paid ones imply the user can pay
  const needsDeposit = !hasDeposited

  async function join() {
    setBusy(true)
    setError('')
    const res = await fetch(`/api/tournaments/${t.id}/join`, { method: 'POST' })
    const d = await res.json().catch(() => ({}))
    setBusy(false)
    if (res.ok) {
      onJoined()
    } else {
      setError(d.error || 'Could not join the tournament.')
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-qx-panel2 p-6 shadow-panel">
        <div className="flex items-start justify-between">
          <h3 className="text-2xl font-bold text-white">Confirm your participation</h3>
          <button onClick={onClose} className="text-2xl leading-none text-qx-textDim hover:text-white">×</button>
        </div>

        <div className="my-5 space-y-2 border-y border-qx-border py-4">
          <Row label="Tournament:" value={t.name} />
          <Row label="Entry fee:" value={`${t.entryFee || 0} $`} />
        </div>

        {needsDeposit ? (
          <>
            <div className="flex items-start gap-3 text-sm font-semibold text-qx-red">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0">
                <path d="M12 9v4M12 17h.01M10.3 3.8 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              To participate in {t.entryFee ? 'paid' : 'free'} tournaments, you need to deposit a real account at least once.
            </div>
            <button onClick={onDeposit} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#2F8FEE] py-3.5 text-base font-bold text-white transition hover:brightness-110">
              <span className="text-xl leading-none">+</span> Deposit
            </button>
          </>
        ) : (
          <>
            {error && <div className="mb-3 text-sm font-semibold text-qx-red">{error}</div>}
            <button onClick={join} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-qx-green py-3.5 text-base font-bold text-white transition hover:bg-qx-greenHover disabled:opacity-60">
              {busy ? 'Joining…' : t.entryFee ? `Participate — pay ${t.entryFee}$` : 'Participate'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-qx-textDim">{label}</span>
      <span className="text-base font-bold text-white">{value}</span>
    </div>
  )
}
