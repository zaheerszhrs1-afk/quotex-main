'use client'
import { useEffect, useState } from 'react'

// Captures the PWA beforeinstallprompt event and surfaces an "Install app" button.
// On iOS (no beforeinstallprompt) it shows the Share → Add to Home Screen tip.
export default function InstallButton({ compact = false }) {
  const [deferred, setDeferred] = useState(null)
  const [installed, setInstalled] = useState(false)
  const [iosTip, setIosTip] = useState(false)

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault()
      setDeferred(e)
    }
    const onInstalled = () => setInstalled(true)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    if (window.matchMedia('(display-mode: standalone)').matches) setInstalled(true)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (installed) return null

  async function click() {
    if (deferred) {
      deferred.prompt()
      await deferred.userChoice
      setDeferred(null)
    } else {
      // likely iOS Safari
      setIosTip(true)
      setTimeout(() => setIosTip(false), 5000)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={click}
        className="flex items-center gap-1.5 rounded-lg bg-qx-panel2 px-3 py-2 text-xs font-semibold text-white hover:bg-qx-border"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 3v12M7 10l5 5 5-5M5 21h14" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {!compact && 'Install app'}
      </button>
      {iosTip && (
        <div className="absolute right-0 top-11 z-50 w-56 rounded-lg border border-qx-border bg-qx-panel p-3 text-xs text-white shadow-panel">
          Tap <strong>Share</strong> → <strong>Add to Home Screen</strong> to install.
        </div>
      )}
    </div>
  )
}
