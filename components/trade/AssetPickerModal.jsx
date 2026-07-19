'use client'
import { useState } from 'react'
import { useStore } from '@/lib/store'
import AssetIcon from './AssetIcon'

const CATS = [
  { id: 'Currencies', label: 'CURRENCIES' },
  { id: 'Crypto', label: 'CRYPTO' },
  { id: 'Commodities', label: 'COMMODITIES' },
  { id: 'Stocks', label: 'STOCKS' },
]

export default function AssetPickerModal({ onClose }) {
  const assets = useStore((s) => s.assets)
  const summary = useStore((s) => s.summary)
  const favorites = useStore((s) => s.favorites)
  const toggleFavorite = useStore((s) => s.toggleFavorite)
  const openSymbol = useStore((s) => s.openSymbol)

  const [cat, setCat] = useState('Currencies')
  const [q, setQ] = useState('')
  const [favOnly, setFavOnly] = useState(false)

  const rows = assets
    .filter((a) => (favOnly ? favorites.includes(a.symbol) : a.category === cat))
    .filter((a) => a.symbol.toLowerCase().includes(q.toLowerCase()))

  function pick(sym) {
    openSymbol(sym)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 md:absolute md:z-40">
      <div className="absolute inset-0 bg-black/45" onClick={onClose} />
      <div className="absolute inset-0 z-10 flex flex-col rounded-none bg-[#0B1019] p-4 shadow-panel md:inset-auto md:left-2 md:top-2 md:max-h-[calc(100%-1rem)] md:w-[660px] md:max-w-[calc(100%-1rem)] md:rounded-2xl md:p-5">
        <div className="mb-4 flex shrink-0 items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Select trade pair</h2>
          <button onClick={onClose} className="text-2xl text-qx-textDim hover:text-white">✕</button>
        </div>

        {/* categories */}
        <div className="mb-4 flex shrink-0 gap-5 overflow-x-auto border-b border-qx-border">
          {CATS.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setCat(c.id)
                setFavOnly(false)
              }}
              className={`whitespace-nowrap pb-2 text-sm font-bold transition ${
                !favOnly && cat === c.id
                  ? 'border-b-2 border-[#2F8FEE] text-[#2F8FEE]'
                  : 'text-qx-textDim hover:text-white'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* search + favorites */}
        <div className="mb-3 flex shrink-0 items-center gap-3">
          <button
            onClick={() => setFavOnly((f) => !f)}
            className={`flex items-center gap-1 rounded-lg border border-qx-border px-3 py-2.5 text-sm ${
              favOnly ? 'bg-qx-panel2 text-qx-gold' : 'text-qx-textDim'
            }`}
          >
            ★ {favorites.length}
          </button>
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-qx-textMute" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" strokeLinecap="round" />
            </svg>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search"
              className="w-full rounded-lg bg-qx-panel py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-qx-textMute outline-none"
            />
          </div>
        </div>

        {/* header row */}
        <div className="grid shrink-0 grid-cols-[1fr_110px_90px_90px] gap-2 border-b border-qx-border px-1 py-2 text-xs font-semibold text-qx-textMute">
          <span>Name</span>
          <span className="text-right">24h changing</span>
          <span className="text-right">Profit 1+ min</span>
          <span className="text-right">5+ min</span>
        </div>

        {/* rows */}
        <div className="flex-1 overflow-y-auto">
          {rows.length === 0 && (
            <div className="p-8 text-center text-sm text-qx-textMute">
              {cat === 'Stocks' ? 'No stocks available.' : 'No pairs found.'}
            </div>
          )}
          {rows.map((a) => {
            const s = summary[a.symbol]
            const change = s?.changePct ?? 0
            const up = change >= 0
            const fav = favorites.includes(a.symbol)
            return (
              <div
                key={a.symbol}
                onClick={() => pick(a.symbol)}
                className="grid cursor-pointer grid-cols-[1fr_110px_90px_90px] items-center gap-2 border-b border-qx-border/40 px-1 py-3 hover:bg-qx-panel/60"
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleFavorite(a.symbol)
                    }}
                    className={fav ? 'text-qx-gold' : 'text-qx-textMute'}
                  >
                    {fav ? '★' : '☆'}
                  </button>
                  <AssetIcon symbol={a.symbol} size={28} />
                  <div>
                    <div className="text-sm font-bold text-white">{a.symbol}</div>
                    <div className="text-xs text-qx-textMute">{a.category}</div>
                  </div>
                </div>
                <div className={`flex items-center justify-end gap-1 text-sm font-semibold ${up ? 'text-qx-green' : 'text-qx-red'}`}>
                  {up ? '▲' : '▼'} {Math.abs(change)}%
                </div>
                <div className="text-right text-sm font-bold text-qx-gold">{a.payout}%</div>
                <div className="text-right text-sm font-bold text-qx-gold">{Math.max(40, a.payout - 3)}%</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
