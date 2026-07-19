'use client'

import Loader from '@/components/ui/Loader'

// Quotex-style loading overlay shown inside the chart while candle data is
// streaming in (initial load, pair switch, timeframe switch). Uses the real
// Quotex loader (white disc + sweeping ring + animated "Q").
export default function ChartLoader() {
  return (
    <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-qx-bg/70 backdrop-blur-[2px]">
      <Loader size={64} />
    </div>
  )
}
