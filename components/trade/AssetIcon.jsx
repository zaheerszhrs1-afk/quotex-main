'use client'

// Real per-asset icons (like Quotex): each forex leg shows its country flag,
// crypto shows the coin logo, commodities/unknowns show a styled badge.
//
// Flags: flagcdn (raster PNG so they render everywhere, incl. Windows & the TWA
// APK where flag emoji degrade to letters). Crypto: coincap icon CDN.

const CURRENCY_CC = {
  USD: 'us', EUR: 'eu', GBP: 'gb', JPY: 'jp', AUD: 'au', CHF: 'ch',
  NZD: 'nz', CAD: 'ca', MXN: 'mx', BRL: 'br', NGN: 'ng', IDR: 'id',
  DZD: 'dz', PKR: 'pk', INR: 'in', ARS: 'ar', ZAR: 'za', TRY: 'tr',
  CNY: 'cn', RUB: 'ru', SGD: 'sg', HKD: 'hk', SEK: 'se', NOK: 'no',
}

const CRYPTO = { BTC: 'btc', ETH: 'eth', LTC: 'ltc', XRP: 'xrp', BCH: 'bch', DOGE: 'doge', SOL: 'sol', BNB: 'bnb' }

// Stock tickers -> TradingView logo slugs (real company logos)
const STOCKS = {
  AAPL: 'apple', TSLA: 'tesla', AMZN: 'amazon', GOOGL: 'alphabet',
  MSFT: 'microsoft', META: 'meta-platforms', NFLX: 'netflix', NVDA: 'nvidia',
}

// commodities / indices that aren't a CCY/CCY pair
const SPECIAL = {
  Gold: { bg: 'from-yellow-300 to-amber-500', label: 'Au', text: 'text-amber-900' },
  Silver: { bg: 'from-slate-200 to-slate-400', label: 'Ag', text: 'text-slate-800' },
  Oil: { bg: 'from-zinc-600 to-zinc-900', label: 'OIL', text: 'text-white' },
  USCrude: { bg: 'from-zinc-600 to-zinc-900', label: 'OIL', text: 'text-white' },
}

const core = (symbol) => String(symbol || '').replace(/\s*\(OTC\)\s*/i, '').trim()

function Leg({ code, size }) {
  const style = { width: size, height: size }
  const cc = CURRENCY_CC[code]
  if (cc) {
    return (
      <img
        src={`https://flagcdn.com/w80/${cc}.png`}
        alt=""
        loading="lazy"
        style={style}
        className="rounded-full object-cover ring-2 ring-qx-bg"
      />
    )
  }
  if (CRYPTO[code]) {
    return (
      <img
        src={`https://assets.coincap.io/assets/icons/${CRYPTO[code]}@2x.png`}
        alt=""
        loading="lazy"
        style={style}
        className="rounded-full bg-white object-contain p-0.5 ring-2 ring-qx-bg"
      />
    )
  }
  if (STOCKS[code]) {
    return (
      <img
        src={`https://s3-symbol-logo.tradingview.com/${STOCKS[code]}--big.svg`}
        alt=""
        loading="lazy"
        style={style}
        className="rounded-full bg-white object-contain p-1 ring-2 ring-qx-bg"
      />
    )
  }
  const sp = SPECIAL[code]
  return (
    <span
      style={{ ...style, fontSize: Math.round(size * 0.34) }}
      className={`flex items-center justify-center rounded-full bg-gradient-to-br ring-2 ring-qx-bg font-bold ${sp ? sp.bg : 'from-blue-500 to-blue-700'} ${sp ? sp.text : 'text-white'}`}
    >
      {sp ? sp.label : code.slice(0, 2).toUpperCase()}
    </span>
  )
}

export default function AssetIcon({ symbol, size = 28 }) {
  const c = core(symbol)
  const parts = c.includes('/') ? c.split('/').map((s) => s.trim()) : [c]

  if (parts.length >= 2) {
    const offset = Math.round(size * 0.55)
    return (
      <span className="relative inline-flex shrink-0" style={{ width: size + offset, height: size }}>
        <span className="absolute left-0 top-0">
          <Leg code={parts[0]} size={size} />
        </span>
        <span className="absolute top-0" style={{ left: offset }}>
          <Leg code={parts[1]} size={size} />
        </span>
      </span>
    )
  }
  return (
    <span className="inline-flex shrink-0">
      <Leg code={parts[0]} size={size} />
    </span>
  )
}
