'use client'
import { useState } from 'react'

// Brand icons for the cashier payment methods. We use the real brand logos
// (Clearbit for companies, Coincap for coins) and fall back to a drawn,
// brand-coloured badge if the image can't load (offline / blocked / unknown).

function inferKey(name = '') {
  const n = name.toLowerCase()
  if (n.includes('jazz')) return 'jazzcash'
  if (n.includes('easy')) return 'easypaisa'
  if (n.includes('binance')) return 'binance'
  if (n.includes('cashmaal')) return 'cashmaal'
  if (n.includes('usdt') || n.includes('tether')) return 'usdt'
  if (n.includes('eth')) return 'eth'
  if (n.includes('btc') || n.includes('bitcoin')) return 'btc'
  if (n.includes('visa') || n.includes('card') || n.includes('master')) return 'visa'
  if (n.includes('bank')) return 'bank'
  return 'generic'
}

const LOGO_URLS = {
  jazzcash: 'https://logo.clearbit.com/jazzcash.com.pk',
  easypaisa: 'https://logo.clearbit.com/easypaisa.com.pk',
  binance: 'https://logo.clearbit.com/binance.com',
  cashmaal: 'https://logo.clearbit.com/cashmaal.com',
  visa: 'https://logo.clearbit.com/visa.com',
  usdt: 'https://assets.coincap.io/assets/icons/usdt@2x.png',
  btc: 'https://assets.coincap.io/assets/icons/btc@2x.png',
  eth: 'https://assets.coincap.io/assets/icons/eth@2x.png',
}

export default function PaymentLogo({ name = '', logo = '', size = 36 }) {
  const key = logo || inferKey(name)
  const [err, setErr] = useState(false)
  const s = { width: size, height: size }
  const url = LOGO_URLS[key]

  if (url && !err) {
    return (
      <img
        src={url}
        alt=""
        loading="lazy"
        onError={() => setErr(true)}
        style={s}
        className="shrink-0 rounded-full bg-white object-contain p-0.5 ring-1 ring-black/5"
      />
    )
  }

  return <DrawnLogo name={name} logoKey={key} size={size} />
}

// Self-contained, brand-coloured fallback badges.
function DrawnLogo({ name, logoKey, size }) {
  const s = { width: size, height: size }
  const round = 'shrink-0 rounded-full'

  switch (logoKey) {
    case 'jazzcash':
      return (
        <span className={`${round} flex items-center justify-center`} style={{ ...s, background: 'linear-gradient(135deg,#ED1C24,#F58220)' }}>
          <span className="font-extrabold text-white" style={{ fontSize: size * 0.42, lineHeight: 1 }}>JC</span>
        </span>
      )
    case 'easypaisa':
      return (
        <span className={`${round} flex items-center justify-center`} style={{ ...s, background: '#0E9B4C' }}>
          <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="#fff">
            <path d="M12 2c3 4 6 6.5 6 10a6 6 0 11-12 0c0-3.5 3-6 6-10z" />
          </svg>
        </span>
      )
    case 'binance':
      return (
        <span className={`${round} flex items-center justify-center bg-white`} style={s}>
          <svg width={size * 0.66} height={size * 0.66} viewBox="0 0 24 24" fill="#F3BA2F">
            <path d="M12 2.5l2.6 2.6L12 7.7 9.4 5.1 12 2.5zM5.1 9.4L7.7 12l-2.6 2.6L2.5 12l2.6-2.6zM12 16.3l2.6 2.6L12 21.5l-2.6-2.6 2.6-2.6zM18.9 9.4L21.5 12l-2.6 2.6L16.3 12l2.6-2.6zM12 9.1L14.9 12 12 14.9 9.1 12 12 9.1z" />
          </svg>
        </span>
      )
    case 'usdt':
      return (
        <span className={`${round} flex items-center justify-center`} style={{ ...s, background: '#26A17B' }}>
          <span className="font-extrabold text-white" style={{ fontSize: size * 0.5, lineHeight: 1 }}>₮</span>
        </span>
      )
    case 'btc':
      return (
        <span className={`${round} flex items-center justify-center`} style={{ ...s, background: '#F7931A' }}>
          <span className="font-extrabold text-white" style={{ fontSize: size * 0.55, lineHeight: 1 }}>₿</span>
        </span>
      )
    case 'eth':
      return (
        <span className={`${round} flex items-center justify-center`} style={{ ...s, background: '#627EEA' }}>
          <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="#fff">
            <path d="M12 2l6 10-6 3.6L6 12z" opacity="0.85" /><path d="M12 16.8l6-3.6-6 8.8-6-8.8z" />
          </svg>
        </span>
      )
    case 'visa':
      return (
        <span className={`${round} flex items-center justify-center bg-white`} style={s}>
          <span className="font-extrabold italic text-[#1A1F71]" style={{ fontSize: size * 0.3, lineHeight: 1 }}>VISA</span>
        </span>
      )
    case 'cashmaal':
      return (
        <span className={`${round} flex items-center justify-center border-2 border-[#1B2433] bg-white`} style={s}>
          <span className="font-extrabold text-[#1B2433]" style={{ fontSize: size * 0.34, lineHeight: 1 }}>CM</span>
        </span>
      )
    case 'bank':
      return (
        <span className={`${round} flex items-center justify-center`} style={{ ...s, background: '#2F8FEE' }}>
          <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
            <path d="M3 10l9-5 9 5M5 10v8m4-8v8m6-8v8m4-8v8M3 21h18" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      )
    default:
      return (
        <span className={`${round} flex items-center justify-center bg-qx-panel2`} style={s}>
          <span className="font-extrabold text-white" style={{ fontSize: size * 0.42, lineHeight: 1 }}>
            {(name || '?').charAt(0).toUpperCase()}
          </span>
        </span>
      )
  }
}
