// Quotex-style spinner: the real loader.svg (white disc, blue sweeping ring and
// the animated Quotex "Q" in the centre). Used while the terminal boots and while
// candle data streams into the chart. The SMIL ring animation runs even when the
// SVG is served via <img>, so this stays light and cached.
export default function Loader({ size = 64, label = 'Loading', className = '' }) {
  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      <img
        src="/loader.svg"
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size }}
        draggable={false}
      />
      {label ? (
        <div className="flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-qx-textDim">
          {label}
          <span className="flex gap-0.5">
            <span className="h-1 w-1 animate-qxdot rounded-full bg-qx-green [animation-delay:0ms]" />
            <span className="h-1 w-1 animate-qxdot rounded-full bg-qx-green [animation-delay:160ms]" />
            <span className="h-1 w-1 animate-qxdot rounded-full bg-qx-green [animation-delay:320ms]" />
          </span>
        </div>
      ) : null}
    </div>
  )
}
