'use client'
import { useEffect, useState, useCallback } from 'react'
import Pagination from '@/components/admin/Pagination'

export default function AdminAssets() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 })

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/admin/assets?page=${page}&limit=20`)
      .then((r) => r.json())
      .then((d) => {
        setRows(d.assets || [])
        setPagination(d.pagination || { page: 1, totalPages: 1, total: 0 })
      })
      .finally(() => setLoading(false))
  }, [page])

  useEffect(() => {
    load()
  }, [load])

  async function patch(id, body) {
    const res = await fetch(`/api/admin/assets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      const d = await res.json()
      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...d.asset } : r)))
    }
  }

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">Assets</h1>
      <p className="mb-4 text-sm text-qx-textMute">
        Payout/active changes save immediately. Restart the WS server for active toggles to affect the live price stream.
      </p>
      {loading ? (
        <p className="text-qx-textDim">Loading…</p>
      ) : (
        <div className="qx-card overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-xs text-qx-textMute">
              <tr className="border-b border-qx-border">
                <th className="px-4 py-3 text-left">Symbol</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-left">Payout %</th>
                <th className="px-4 py-3 text-left">Active</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} className="border-b border-qx-border/50">
                  <td className="px-4 py-3 font-semibold text-white">{a.symbol}</td>
                  <td className="px-4 py-3 text-qx-textDim">{a.name}</td>
                  <td className="px-4 py-3 text-qx-textDim">{a.category}</td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      defaultValue={a.payout}
                      onBlur={(e) => {
                        const v = Number(e.target.value)
                        if (v !== a.payout) patch(a.id, { payout: v })
                      }}
                      className="w-20 rounded-md border border-qx-border bg-qx-input px-2 py-1 text-white outline-none focus:border-qx-green"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => patch(a.id, { isActive: !a.isActive })}
                      className={`relative h-6 w-11 rounded-full transition ${a.isActive ? 'bg-qx-green' : 'bg-qx-panel2'}`}
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${a.isActive ? 'left-[22px]' : 'left-0.5'}`}
                      />
                    </button>
                  </td>
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
