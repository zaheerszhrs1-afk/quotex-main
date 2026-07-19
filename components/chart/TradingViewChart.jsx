'use client'
import { useEffect, useRef, useId } from 'react'

// our asset symbol -> TradingView symbol. OTC/synthetic pairs have no real
// TradingView feed, so tvSymbol() returns null for them and the caller falls
// back to the built-in chart.
const TV_SYMBOLS = {
  'BTC/USD': 'BINANCE:BTCUSDT',
  'ETH/USD': 'BINANCE:ETHUSDT',
  // OANDA to match our Finnhub OANDA resolution feed (so chart == trade result)
  'EUR/USD': 'OANDA:EURUSD',
  'GBP/USD': 'OANDA:GBPUSD',
  'USD/JPY': 'OANDA:USDJPY',
  'AUD/USD': 'OANDA:AUDUSD',
  Gold: 'OANDA:XAUUSD',
  Oil: 'OANDA:WTICOUSD',
  AAPL: 'NASDAQ:AAPL',
  TSLA: 'NASDAQ:TSLA',
  AMZN: 'NASDAQ:AMZN',
  GOOGL: 'NASDAQ:GOOGL',
  MSFT: 'NASDAQ:MSFT',
  META: 'NASDAQ:META',
  NFLX: 'NASDAQ:NFLX',
  NVDA: 'NASDAQ:NVDA',
}

export function tvSymbol(symbol) {
  return TV_SYMBOLS[symbol] || null
}

// load the TradingView embed script once, shared across mounts
let tvScriptPromise = null
function loadTradingView() {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.TradingView) return Promise.resolve()
  if (tvScriptPromise) return tvScriptPromise
  tvScriptPromise = new Promise((resolve) => {
    const s = document.createElement('script')
    s.src = 'https://s3.tradingview.com/tv.js'
    s.async = true
    s.onload = () => resolve()
    document.head.appendChild(s)
  })
  return tvScriptPromise
}

// our timeframe -> TradingView interval (TV has no sub-minute, so those map to 1)
const TF_TO_TV = { '5s': '1', '10s': '1', '15s': '1', '30s': '1', '1m': '1', '2m': '1', '3m': '3', '5m': '5', '10m': '10', '15m': '15', '30m': '30', '1h': '60', '4h': '240', '1d': 'D' }

export default function TradingViewChart({ symbol, timeframe }) {
  const ref = useRef(null)
  const containerId = 'tv_' + useId().replace(/[^a-zA-Z0-9_]/g, '')
  const tvSym = tvSymbol(symbol)
  const interval = TF_TO_TV[timeframe] || '1'

  useEffect(() => {
    if (!tvSym) return
    let cancelled = false
    loadTradingView().then(() => {
      if (cancelled || !ref.current || !window.TradingView) return
      ref.current.innerHTML = ''
      // eslint-disable-next-line no-new
      new window.TradingView.widget({
        container_id: ref.current.id,
        symbol: tvSym,
        interval,
        autosize: true,
        timezone: 'Etc/UTC',
        theme: 'dark',
        style: '1', // candles
        locale: 'en',
        toolbar_bg: '#0E1621',
        backgroundColor: '#0E1621',
        hide_side_toolbar: false,
        allow_symbol_change: false,
        save_image: false,
        withdateranges: true,
      })
    })
    return () => { cancelled = true }
  }, [tvSym, interval])

  if (!tvSym) return null // caller renders the built-in chart instead

  return <div ref={ref} id={containerId} className="h-full w-full" />
}
