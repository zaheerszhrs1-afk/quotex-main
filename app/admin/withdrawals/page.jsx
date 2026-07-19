'use client'
import { useEffect, useState, useCallback } from 'react'
import { StatusBadge } from '../page'
import Pagination from '@/components/admin/Pagination'

const FILTERS = ['pending', 'approved', 'rejected', 'all']

export default function AdminWithdrawals() {
  const [filter, setFilter] = useState('pending')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 })

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/admin/withdrawals?status=${filter}&page=${page}&limit=20`)
      .then((r) => r.json())
      .then((d) => {
        setRows(d.withdrawals || [])
        setPagination(d.pagination || { page: 1, totalPages: 1, total: 0 })
      })
      .finally(() => setLoading(false))
  }, [filter, page])

  useEffect(() => {
    load()
  }, [load])

  async function act(id, action) {
    let note = ''
    if (action === 'reject') note = prompt('Rejection note (optional):') || ''
    await fetch(`/api/admin/withdrawals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, note }),
    })
    load()
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Withdrawal requests</h1>
      <div className="mb-4 flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => { setFilter(f); setPage(1) }}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${
              filter === f ? 'bg-qx-green text-white' : 'bg-qx-panel2 text-qx-textDim'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="qx-card overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="text-xs text-qx-textMute">
            <tr className="border-b border-qx-border">
              <th className="px-4 py-3 text-left">User</th>
              <th className="px-4 py-3 text-left">Method</th>
              <th className="px-4 py-3 text-left">Amount</th>
              <th className="px-4 py-3 text-left">Recipient</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="p-4 text-qx-textMute">Loading…</td></tr>}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={7} className="p-4 text-qx-textMute">No requests.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-qx-border/50">
                <td className="px-4 py-3 text-qx-textDim">{r.email}</td>
                <td className="px-4 py-3">{r.method}</td>
                <td className="px-4 py-3 font-semibold text-white">${r.amount}</td>
                <td className="px-4 py-3 text-qx-textDim">{r.recipientDetails || '—'}</td>
                <td className="px-4 py-3 text-qx-textMute">{new Date(r.createdAt).toLocaleString()}</td>
                <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                <td className="px-4 py-3">
                  {r.status === 'pending' ? (
                    <div className="flex gap-2">
                      <button onClick={() => act(r.id, 'approve')} className="rounded-md bg-qx-green px-3 py-1 text-xs font-bold text-white">
                        Approve
                      </button>
                      <button onClick={() => act(r.id, 'reject')} className="rounded-md bg-qx-red px-3 py-1 text-xs font-bold text-white">
                        Reject
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-qx-textMute">{r.adminNote || '—'}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} totalPages={pagination.totalPages} onPageChange={setPage} />
    </div>
  )
}
