'use client'
import { useEffect, useState } from 'react'
import Pagination from '@/components/admin/Pagination'

// Action → colour for the badge. Money/force actions stand out.
const ACTION_STYLE = {
  'user.setBalance': 'bg-qx-gold/15 text-qx-gold',
  'user.ban': 'bg-qx-red/15 text-qx-red',
  'user.setRole': 'bg-qx-gold/15 text-qx-gold',
  'user.force': 'bg-qx-red/15 text-qx-red',
  'trade.force': 'bg-qx-red/15 text-qx-red',
  'deposit.approve': 'bg-qx-green/15 text-qx-green',
  'deposit.reject': 'bg-qx-red/15 text-qx-red',
  'withdrawal.approve': 'bg-qx-green/15 text-qx-green',
  'withdrawal.reject': 'bg-qx-red/15 text-qx-red',
}

const FILTERS = [
  { label: 'All', value: '' },
  { label: 'Balances', value: 'user.setBalance' },
  { label: 'Forced trades', value: 'trade.force' },
  { label: 'Forced users', value: 'user.force' },
  { label: 'Deposits', value: 'deposit.approve' },
  { label: 'Withdrawals', value: 'withdrawal.approve' },
]

function fmtTime(ts) {
  const d = new Date(ts)
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export default function AdminAudit() {
  const [entries, setEntries] = useState(null)
  const [err, setErr] = useState('')
  const [filter, setFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 })

  function load(action, pageNum) {
    setEntries(null)
    const params = new URLSearchParams()
    if (action) params.set('action', action)
    params.set('page', String(pageNum || page))
    params.set('limit', '20')
    fetch(`/api/admin/audit?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setErr(d.error)
        else {
          setEntries(d.entries)
          setPagination(d.pagination || { page: 1, totalPages: 1, total: 0 })
        }
      })
      .catch(() => setErr('Failed to load audit log.'))
  }

  useEffect(() => {
    load(filter, page)
  }, [filter, page])

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Audit log</h1>
          <p className="mt-1 text-sm text-qx-textDim">Every sensitive admin action, newest first.</p>
        </div>
        <button
          onClick={() => load(filter, page)}
          className="rounded-lg bg-qx-panel2 px-3 py-1.5 text-sm font-semibold text-qx-textDim hover:text-white"
        >
          ↻ Refresh
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => { setFilter(f.value); setPage(1) }}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              filter === f.value ? 'bg-qx-green text-white' : 'bg-qx-input text-qx-textDim hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {err && <p className="text-qx-red">{err}</p>}
      {!err && entries === null && <p className="text-qx-textDim">Loading…</p>}

      {entries && (
        <div className="qx-card overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-xs text-qx-textMute">
              <tr className="border-b border-qx-border">
                <th className="px-4 py-3 text-left">When</th>
                <th className="px-4 py-3 text-left">Admin</th>
                <th className="px-4 py-3 text-left">Action</th>
                <th className="px-4 py-3 text-left">Detail</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-qx-textMute">No actions logged yet.</td>
                </tr>
              )}
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-qx-border/50">
                  <td className="whitespace-nowrap px-4 py-3 text-qx-textDim">{fmtTime(e.createdAt)}</td>
                  <td className="px-4 py-3 text-white">{e.admin}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${ACTION_STYLE[e.action] || 'bg-qx-panel2 text-qx-textDim'}`}>
                      {e.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-qx-textDim">{e.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} totalPages={pagination.totalPages} onPageChange={setPage} />
    </div>
  )
}
