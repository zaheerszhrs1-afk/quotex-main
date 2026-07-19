'use client'
import dynamic from 'next/dynamic'
import Loader from '@/components/ui/Loader'

// Terminal is fully client-side (canvas chart + websocket), so skip SSR.
const TradeShell = dynamic(() => import('@/components/trade/TradeShell'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[100dvh] items-center justify-center bg-qx-bg">
      <Loader size={72} label="Loading terminal" />
    </div>
  ),
})

export default function TradePage() {
  return <TradeShell />
}
