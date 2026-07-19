'use client'
import { useEffect, useState } from 'react'

export default function TopTraders() {
  const [traders, setTraders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let on = true
    const load = () =>
      fetch('/api/leaderboard')
        .then((r) => r.json())
        .then((d) => on && setTraders(d.traders || []))
        .catch(() => {})
        .finally(() => on && setLoading(false))
    load()
    const id = setInterval(load, 20000)
    return () => {
      on = false
      clearInterval(id)
    }
  }, [])

  return (
    <div className="p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-bold text-white">
        🏆 Top traders of the week
      </div>
      {loading ? (
        <div className="py-6 text-center text-sm text-qx-textMute">Loading…</div>
      ) : (
        <div className="space-y-1">
          {traders.map((t, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-lg bg-qx-input px-3 py-2"
            >
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                  i === 0
                    ? 'bg-qx-gold text-black'
                    : i === 1
                    ? 'bg-[#C0C7D1] text-black'
                    : i === 2
                    ? 'bg-[#CD7F32] text-black'
                    : 'bg-qx-panel2 text-qx-textDim'
                }`}
              >
                {i + 1}
              </span>
              <div className="flex-1">
                <div className="text-sm font-semibold text-white">{t.name}</div>
                <div className="text-[11px] text-qx-textMute">
                  {t.trades} trades · {t.winRate}% win
                </div>
              </div>
              <div className="text-sm font-bold text-qx-green">+${t.profit.toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
