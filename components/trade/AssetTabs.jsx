'use client'
import { useStore } from '@/lib/store'
import AssetIcon from './AssetIcon'

export default function AssetTabs({ pickerOpen, onToggle }) {
  const openSymbols = useStore((s) => s.openSymbols)
  const activeSymbol = useStore((s) => s.activeSymbol)
  const setActiveSymbol = useStore((s) => s.setActiveSymbol)
  const closeSymbol = useStore((s) => s.closeSymbol)
  const summary = useStore((s) => s.summary)

  return (
    <div className="flex items-center gap-2 overflow-x-auto bg-transparent px-2 py-2">
      <button
        onClick={onToggle}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#2F8FEE] text-white transition hover:brightness-110"
        title={pickerOpen ? 'Close' : 'Add pair'}
        aria-expanded={pickerOpen}
      >
        <svg
          width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
          className={`transition-transform duration-300 ${pickerOpen ? 'rotate-45' : ''}`}
        >
          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
        </svg>
      </button>

      {openSymbols.map((sym) => {
        const active = sym === activeSymbol
        const payout = summary[sym]?.payout ?? 80
        return (
          <div
            key={sym}
            onClick={() => setActiveSymbol(sym)}
            className={`flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-xl px-3 transition ${
              active ? 'bg-qx-panel2/95 shadow-panel' : 'bg-qx-panel/90 shadow-panel hover:bg-qx-panel2/80'
            }`}
          >
            <AssetIcon symbol={sym} size={22} />
            <div className="leading-tight">
              <div className="text-sm font-bold text-white">{sym}</div>
              <div className="text-xs font-semibold text-qx-gold">{payout}%</div>
            </div>
            {active && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  closeSymbol(sym)
                }}
                className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/40 text-xs text-qx-textDim hover:text-white"
                title="Close"
              >
                ✕
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
