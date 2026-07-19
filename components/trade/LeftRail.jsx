'use client'

// Slim vertical icon rail like the real Quotex (TRADE / SUPPORT / ACCOUNT /
// TOURNAMENTS / MORE + utility icons + Help). Mostly navigational chrome.
function RailItem({ icon, label, active, activeGray, badge, onClick, accent }) {
  const on = active || activeGray
  return (
    <button
      onClick={onClick}
      className={`relative flex w-full flex-col items-center gap-1 py-3 text-[10px] font-semibold transition ${
        on ? 'text-white' : accent ? 'text-white' : 'text-qx-textMute hover:text-white'
      }`}
    >
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-xl ${
          active ? 'bg-[#2F8FEE] text-white' : activeGray ? 'bg-qx-panel2 text-white' : accent ? 'bg-qx-green text-white' : 'bg-transparent'
        }`}
      >
        {icon}
      </span>
      {label}
      {badge ? (
        <span className="absolute right-3 top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#2F8FEE] px-1 text-[9px] font-bold text-white">
          {badge}
        </span>
      ) : null}
    </button>
  )
}

const I = {
  trade: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18M7 14l3-4 3 3 4-6" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  support: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 113.5 2.3c-.8.4-1 .9-1 1.7M12 17h.01" strokeLinecap="round" /></svg>,
  account: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M4 20a8 8 0 0116 0" strokeLinecap="round" /></svg>,
  cup: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 4h12v4a6 6 0 01-12 0zM6 6H3v1a3 3 0 003 3M18 6h3v1a3 3 0 01-3 3M9 18h6M12 14v4" strokeLinecap="round" /></svg>,
  more: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>,
  help: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9.5 9a2.5 2.5 0 113.5 2.3c-.8.4-1 .9-1 1.7M12 17h.01" strokeLinecap="round" /></svg>,
}

export default function LeftRail({ onTrade, onAccount, onSupport, onMore, onTournaments, supportActive, moreActive, accountActive, tournamentsActive }) {
  function fullscreen() {
    if (document.fullscreenElement) document.exitFullscreen?.()
    else document.documentElement.requestFullscreen?.()
  }
  return (
    <div className="flex h-full w-[68px] shrink-0 flex-col justify-between border-r border-qx-border bg-qx-panel py-2">
      <div>
        <RailItem icon={I.trade} label="TRADE" active onClick={onTrade} />
        <RailItem icon={I.support} label="SUPPORT" active={supportActive} onClick={onSupport} />
        <RailItem icon={I.account} label="ACCOUNT" active={accountActive} onClick={onAccount} />
        <RailItem icon={I.cup} label="TOURNA-MENTS" badge="3" active={tournamentsActive} onClick={onTournaments} />
        <RailItem icon={I.more} label="MORE" activeGray={moreActive} onClick={onMore} />
      </div>
      <div>
        <button onClick={fullscreen} title="Fullscreen" className="flex w-full justify-center py-2 text-qx-textMute hover:text-white">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" strokeLinecap="round" /></svg>
        </button>
        <RailItem icon={I.help} label="Help" accent onClick={onSupport} />
      </div>
    </div>
  )
}
