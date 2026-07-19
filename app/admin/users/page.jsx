'use client'
import { useEffect, useState, useCallback } from 'react'
import Pagination from '@/components/admin/Pagination'

export default function AdminUsers() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 })

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/admin/users?page=${page}&limit=20&q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((d) => {
        setRows(d.users || [])
        setPagination(d.pagination || { page: 1, totalPages: 1, total: 0 })
      })
      .finally(() => setLoading(false))
  }, [page, q])

  useEffect(() => {
    load()
  }, [load])

  async function patch(id, body) {
    await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    load()
  }

  function editBalance(u, field) {
    const value = prompt(`Set ${field} for ${u.email}:`, u[field])
    if (value == null) return
    patch(u.id, { action: 'setBalance', field, value })
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Users</h1>
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setPage(1) }}
        placeholder="Search email…"
        className="qx-input mb-4 max-w-xs"
      />
      <div className="qx-card overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="text-xs text-qx-textMute">
            <tr className="border-b border-qx-border">
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Demo</th>
              <th className="px-4 py-3 text-left">Real</th>
              <th className="px-4 py-3 text-left">Trades</th>
              <th className="px-4 py-3 text-left">Joined</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} className="p-4 text-qx-textMute">Loading…</td></tr>}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={8} className="p-4 text-qx-textMute">No users found.</td></tr>
            )}
            {rows.map((u) => (
              <tr key={u.id} className="border-b border-qx-border/50">
                <td className="px-4 py-3 text-white">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={u.role === 'admin' ? 'text-qx-gold' : 'text-qx-textDim'}>{u.role}</span>
                </td>
                <td className="cursor-pointer px-4 py-3 text-qx-textDim hover:text-white" onClick={() => editBalance(u, 'demoBalance')}>
                  ${u.demoBalance.toFixed(2)} ✎
                </td>
                <td className="cursor-pointer px-4 py-3 text-qx-textDim hover:text-white" onClick={() => editBalance(u, 'realBalance')}>
                  ${u.realBalance.toFixed(2)} ✎
                </td>
                <td className="px-4 py-3">{u.trades}</td>
                <td className="px-4 py-3 text-qx-textMute">{new Date(u.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  {u.isBanned ? (
                    <span className="rounded bg-qx-red/15 px-2 py-0.5 text-[11px] font-bold text-qx-red">Banned</span>
                  ) : (
                    <span className="rounded bg-qx-green/15 px-2 py-0.5 text-[11px] font-bold text-qx-green">Active</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        patch(u.id, { action: 'setRole', role: u.role === 'admin' ? 'user' : 'admin' })
                      }
                      className={`rounded-md px-3 py-1 text-xs font-bold text-white ${
                        u.role === 'admin' ? 'bg-qx-panel2 hover:bg-qx-border' : 'bg-qx-gold/80 hover:bg-qx-gold'
                      }`}
                    >
                      {u.role === 'admin' ? 'Remove admin' : 'Make admin'}
                    </button>
                    <button
                      onClick={() => patch(u.id, { action: 'ban' })}
                      className={`rounded-md px-3 py-1 text-xs font-bold text-white ${u.isBanned ? 'bg-qx-green' : 'bg-qx-red'}`}
                    >
                      {u.isBanned ? 'Unban' : 'Ban'}
                    </button>
                  </div>
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
