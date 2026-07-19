// Brand logo. Renders the real Quotex mark + wordmark as a transparent SVG so it
// stays crisp at any size and sits cleanly on the dark UI (no background box).
// `textClass` is kept for backward-compat with existing callers — only its size
// hint ("lg") is used to pick a height.
export default function QuotexLogo({ className = '', textClass = '' }) {
  const h = textClass.includes('lg') ? 'h-6' : 'h-7'
  return (
    <img
      src="/quotex-logo-white.svg"
      alt="Quotex"
      draggable={false}
      className={`${h} w-auto select-none ${className}`}
    />
  )
}
