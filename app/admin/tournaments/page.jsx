'use client'
import { useEffect, useState, useCallback } from 'react'
import Pagination from '@/components/admin/Pagination'

const EMPTY = {
  name: '',
  description: '',
  prizePool: 1000,
  entryFee: 0,
  rebuyCost: 1,
  rebuys: 100,
  startBalance: 10000,
  startTime: '',
  endTime: '',
  prizes: '400, 250, 200, 100, 50',
}

const fmt = (d) => new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
// Date -> value for <input type="datetime-local"> (local time, no seconds)
const toLocalInput = (d) => {
  const t = new Date(d)
  const off = t.getTimezoneOffset() * 60000
  return new Date(t.getTime() - off).toISOString().slice(0, 16)
}

export default function AdminTournaments() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 })

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/admin/tournaments?page=${page}&limit=20`)
      .then((r) => r.json())
      .then((d) => {
        setRows(d.tournaments || [])
        setPagination(d.pagination || { page: 1, totalPages: 1, total: 0 })
      })
      .finally(() => setLoading(false))
  }, [page])

  useEffect(() => {
    load()
  }, [load])

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  function resetForm() {
    setForm(EMPTY)
    setEditId(null)
  }

  function editRow(t) {
    setEditId(t.id)
    setForm({
      name: t.name,
      description: t.description || '',
      prizePool: t.prizePool,
      entryFee: t.entryFee,
      rebuyCost: t.rebuyCost,
      rebuys: t.rebuys,
      startBalance: t.startBalance,
      startTime: toLocalInput(t.startTime),
      endTime: toLocalInput(t.endTime),
      prizes: (t.prizes || []).join(', '),
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function save() {
    setSaving(true)
    setMsg('')
    const payload = {
      ...form,
      prizePool: Number(form.prizePool),
      entryFee: Number(form.entryFee),
      rebuyCost: Number(form.rebuyCost),
      rebuys: Number(form.rebuys),
      startBalance: Number(form.startBalance),
      startTime: form.startTime ? new Date(form.startTime).toISOString() : null,
      endTime: form.endTime ? new Date(form.endTime).toISOString() : null,
      prizes: form.prizes.split(',').map((s) => Number(s.trim())).filter((n) => !isNaN(n)),
    }
    const url = editId ? `/api/admin/tournaments/${editId}` : '/api/admin/tournaments'
    const res = await fetch(url, {
      method: editId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSaving(false)
    const d = await res.json().catch(() => ({}))
    if (res.ok) {
      setMsg(editId ? 'Updated ✓' : 'Created ✓')
      resetForm()
      load()
    } else {
      setMsg(d.error || 'Save failed')
    }
    setTimeout(() => setMsg(''), 3000)
  }

  async function patch(id, body) {
    await fetch(`/api/admin/tournaments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    load()
  }

  async function remove(id) {
    if (!confirm('Delete this tournament and all its entries?')) return
    await fetch(`/api/admin/tournaments/${id}`, { method: 'DELETE' })
    if (editId === id) resetForm()
    load()
  }

  return (
    <div className="max-w-4xl">
      <h1 className="mb-4 text-2xl font-bold">Tournaments</h1>

      {/* create / edit form */}
      <div className="qx-card mb-8 p-5">
        <h2 className="mb-4 text-lg font-bold">{editId ? 'Edit tournament' : 'New tournament'}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" full>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} className="qx-input" placeholder="Free Friday" />
          </Field>
          <Field label="Description" full>
            <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={2} className="qx-input" placeholder="Optional details shown on the tournament page" />
          </Field>
          <Num label="Prize pool ($)" value={form.prizePool} onChange={(v) => set('prizePool', v)} />
          <Num label="Entry fee ($, 0 = free)" value={form.entryFee} onChange={(v) => set('entryFee', v)} />
          <Num label="Rebuy cost ($)" value={form.rebuyCost} onChange={(v) => set('rebuyCost', v)} />
          <Num label="Number of rebuys" value={form.rebuys} onChange={(v) => set('rebuys', v)} />
          <Num label="Start balance ($)" value={form.startBalance} onChange={(v) => set('startBalance', v)} />
          <Field label="Prizes (comma-separated, by rank)" full>
            <input value={form.prizes} onChange={(e) => set('prizes', e.target.value)} className="qx-input" placeholder="400, 250, 200, 100, 50" />
          </Field>
          <Field label="Start time">
            <input type="datetime-local" value={form.startTime} onChange={(e) => set('startTime', e.target.value)} className="qx-input [color-scheme:dark]" />
          </Field>
          <Field label="End time">
            <input type="datetime-local" value={form.endTime} onChange={(e) => set('endTime', e.target.value)} className="qx-input [color-scheme:dark]" />
          </Field>
        </div>
        <div className="mt-5 flex items-center gap-3">
          <button onClick={save} disabled={saving} className="qx-btn-green">
            {saving ? 'Saving…' : editId ? 'Update tournament' : 'Create tournament'}
          </button>
          {editId && (
            <button onClick={resetForm} className="qx-btn-ghost">Cancel</button>
          )}
          {msg && <span className="text-sm text-qx-green">{msg}</span>}
        </div>
      </div>

      {/* list */}
      {loading ? (
        <p className="text-qx-textDim">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-qx-textMute">No tournaments yet — create one above.</p>
      ) : (
        <div className="qx-card overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-xs text-qx-textMute">
              <tr className="border-b border-qx-border">
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Prize</th>
                <th className="px-4 py-3 text-left">Entry</th>
                <th className="px-4 py-3 text-left">Window</th>
                <th className="px-4 py-3 text-left">Players</th>
                <th className="px-4 py-3 text-left">Visible</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} className="border-b border-qx-border/50">
                  <td className="px-4 py-3 font-semibold text-white">{t.name}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded px-2 py-0.5 text-[11px] font-bold capitalize ${
                      t.status === 'active' ? 'bg-qx-green/15 text-qx-green'
                        : t.status === 'upcoming' ? 'bg-[#2F8FEE]/15 text-[#5B9BFF]'
                          : 'bg-qx-panel2 text-qx-textDim'
                    }`}>{t.status}</span>
                  </td>
                  <td className="px-4 py-3 text-qx-green">${t.prizePool}</td>
                  <td className="px-4 py-3 text-qx-textDim">{t.entryFee ? `$${t.entryFee}` : 'Free'}</td>
                  <td className="px-4 py-3 text-qx-textMute">{fmt(t.startTime)} → {fmt(t.endTime)}</td>
                  <td className="px-4 py-3">{t.participants}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => patch(t.id, { isActive: !t.isActive })}
                      className={`relative h-6 w-11 rounded-full transition ${t.isActive ? 'bg-qx-green' : 'bg-qx-panel2'}`}
                    >
                      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${t.isActive ? 'left-[22px]' : 'left-0.5'}`} />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => editRow(t)} className="rounded-md bg-qx-panel2 px-3 py-1 text-xs font-bold text-white hover:bg-qx-border">Edit</button>
                      <button onClick={() => remove(t.id)} className="rounded-md bg-qx-red px-3 py-1 text-xs font-bold text-white">Delete</button>
                    </div>
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

function Field({ label, children, full }) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <label className="qx-label">{label}</label>
      {children}
    </div>
  )
}
function Num({ label, value, onChange }) {
  return (
    <div>
      <label className="qx-label">{label}</label>
      <input type="number" value={value} onChange={(e) => onChange(e.target.value)} className="qx-input" />
    </div>
  )
}
