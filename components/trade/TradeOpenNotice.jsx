'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/lib/store'

export default function TradeOpenNotice() {
  const notice = useStore((s) => s.tradeNotice)
  const clearNotice = useStore((s) => s.clearTradeNotice)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    if (!notice) return
    setClosing(false)
    const id = setTimeout(() => {
      setClosing(true)
      setTimeout(clearNotice, 300)
    }, 4500)
    return () => clearTimeout(id)
  }, [notice, clearNotice])

  if (!notice) return null

  const handleClose = () => {
    setClosing(true)
    setTimeout(clearNotice, 280)
  }

  return (
    <div className="pointer-events-auto absolute inset-x-0 top-12 z-30 flex justify-center px-3 md:top-14">
      <div
        className={`flex w-full max-w-[92vw] items-center justify-between gap-3 rounded-lg bg-qx-green px-3.5 py-2.5 shadow-panel md:w-auto md:min-w-[320px] md:max-w-md md:px-4 md:py-2.5 ${
          closing ? 'animate-slideUpOut' : 'animate-slideDown'
        }`}
      >
        <span className="text-sm font-semibold text-white md:text-[15px]">
          Trade opened with price:{" "}
          <span className="font-bold tabular-nums">{Number(notice.openPrice).toFixed(notice.digits || 3)}</span>
          {" "}{notice.symbol}
        </span>
        <button
          onClick={handleClose}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black/20 text-white transition hover:bg-black/30"
          aria-label="Close"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
