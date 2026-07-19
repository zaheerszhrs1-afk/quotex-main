'use client'
import { useEffect, useRef, useState } from 'react'

// Global dropdown selector used across the app so every selector looks the same:
// a trigger with a rotating chevron and an options panel that slides down on open
// and back up on close (animated via grid-rows, so it fits any list length).
//
//   variant="filled" (default) — rounded bg-qx-panel2 chip; for standalone selects
//   variant="bare"             — transparent; sits inside a bordered Field/FormField
//
// options: array of string | { value, label }. onChange receives the value.
const SIZES = {
  sm: 'px-3 py-2 text-sm',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-4 py-3.5 text-[16px] font-bold',
}

export default function Select({
  value,
  onChange,
  options = [],
  variant = 'filled',
  size = 'md',
  align = 'left',
  placeholder = 'Select',
  className = '',
  panelClassName = '',
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const opts = options.map((o) => (typeof o === 'object' && o !== null ? o : { value: o, label: o }))
  const current = opts.find((o) => String(o.value) === String(value))

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const trigger =
    variant === 'bare'
      ? 'bg-transparent text-[15px] text-white'
      : `rounded-xl bg-qx-panel2 font-semibold text-white ${SIZES[size]}`

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center justify-between gap-2 outline-none transition ${trigger} ${className}`}
      >
        <span className="truncate">{current ? current.label : placeholder}</span>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          className={`shrink-0 text-qx-textDim transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* options panel — grid-rows 0fr→1fr gives an accurate slide for any length */}
      <div
        className={`absolute top-full z-40 min-w-full ${align === 'right' ? 'right-0' : 'left-0'} ${
          open ? 'mt-2' : 'pointer-events-none'
        } ${panelClassName}`}
      >
        <div
          className={`grid overflow-hidden rounded-xl bg-qx-panel2 shadow-panel ring-1 ring-qx-border transition-all duration-300 ease-out ${
            open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="max-h-[280px] overflow-y-auto py-1">
              {opts.map((o) => (
                <button
                  key={String(o.value)}
                  type="button"
                  onClick={() => { onChange?.(o.value); setOpen(false) }}
                  className={`block w-full px-4 py-2.5 text-left text-sm font-semibold transition ${
                    String(o.value) === String(value)
                      ? 'bg-qx-panel text-white'
                      : 'text-qx-textDim hover:bg-qx-panel/60 hover:text-white'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
