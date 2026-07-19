'use client'
import { useEffect } from 'react'
import { useStore } from '@/lib/store'

export default function Toasts() {
  const toasts = useStore((s) => s.toasts)
  const removeToast = useStore((s) => s.removeToast)

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[320px] max-w-[90vw] flex-col gap-2">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onClose={() => removeToast(t.id)} />
      ))}
    </div>
  )
}

function Toast({ toast, onClose }) {
  useEffect(() => {
    const id = setTimeout(onClose, 4000)
    return () => clearTimeout(id)
  }, [onClose])

  const styles = {
    win: 'border-qx-green/40 bg-qx-green/10',
    loss: 'border-qx-red/40 bg-qx-red/10',
    info: 'border-qx-border bg-qx-panel2',
  }[toast.type || 'info']

  const accent = {
    win: 'text-qx-green',
    loss: 'text-qx-red',
    info: 'text-white',
  }[toast.type || 'info']

  return (
    <div
      className={`pointer-events-auto animate-slideIn rounded-xl border ${styles} p-3 shadow-panel backdrop-blur`}
    >
      <div className="flex items-start gap-3">
        <div className={`text-xl ${accent}`}>
          {toast.type === 'win' ? '✓' : toast.type === 'loss' ? '✕' : 'ℹ'}
        </div>
        <div className="flex-1">
          <div className={`text-sm font-bold ${accent}`}>{toast.title}</div>
          {toast.msg && <div className="text-xs text-qx-textDim">{toast.msg}</div>}
        </div>
        <button onClick={onClose} className="text-qx-textMute hover:text-white">
          ✕
        </button>
      </div>
    </div>
  )
}
