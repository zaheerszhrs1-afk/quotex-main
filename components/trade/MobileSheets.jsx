'use client'
import { PanelHeader, HelpContent, LeaderBoardContent, SignalsContent } from './RailPanels'

// Mobile (< md) versions of the rail panels. They slide in from the far left
// edge over the chart, leaving a small sliver on the right, while the bottom
// icon bar stays on top — matching the real Quotex mobile app.
export default function MobileSheets({
  panel,
  setPanel,
  onAnalytics,
  onMarket,
  onDeposit,
  onWithdraw,
  onTrades,
  onAccountSection,
  onLogout,
}) {
  const open = !!panel
  const close = () => setPanel(null)
  return (
    <>
      <div
        className={`fixed inset-y-0 left-0 z-40 flex w-full flex-col bg-[#10151F] pb-14 shadow-panel transition-transform duration-300 ease-out md:hidden ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-hidden={!open}
      >
        {panel === 'help' && <HelpContent onClose={close} />}
        {panel === 'more' && (
          <MoreSheet
            onClose={close}
            onMarket={onMarket}
            onAnalytics={onAnalytics}
            onTop={() => setPanel('top')}
            onSignals={() => setPanel('signals')}
            onDeposit={onDeposit}
            onWithdraw={onWithdraw}
            onTrades={onTrades}
            onAccountSection={onAccountSection}
            onLogout={onLogout}
          />
        )}
        {panel === 'top' && <LeaderBoardContent onBack={() => setPanel('more')} onClose={close} />}
        {panel === 'signals' && <SignalsContent onBack={() => setPanel('more')} onClose={close} />}
      </div>
    </>
  )
}

const ICONS = {
  market: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <ellipse cx="12" cy="6" rx="7" ry="3" />
      <path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
  analytics: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2a10 10 0 1010 10h-10z" /><path d="M14 2.2V10h7.8A10 10 0 0014 2.2z" opacity="0.6" />
    </svg>
  ),
  top: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  signals: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="6" opacity="0.7" /><circle cx="12" cy="12" r="9.5" opacity="0.4" />
    </svg>
  ),
}

function MoreSheet({ onClose, onMarket, onAnalytics, onTop, onSignals, onDeposit, onWithdraw, onTrades, onAccountSection, onLogout }) {
  const boxed = [
    { label: 'Market', icon: ICONS.market, badge: '4', onClick: onMarket },
    { label: 'Analytics', icon: ICONS.analytics, onClick: onAnalytics },
    { label: 'TOP', icon: ICONS.top, onClick: onTop },
    { label: 'Signals', icon: ICONS.signals, onClick: onSignals },
  ]
  const plain = [
    { label: 'Deposit', onClick: onDeposit },
    { label: 'Withdrawal', onClick: onWithdraw },
    { label: 'Transactions', onClick: () => onAccountSection?.('Transactions') },
    { label: 'Trades', onClick: onTrades },
    { label: 'My account', onClick: () => onAccountSection?.('My account') },
  ]
  return (
    <>
      <PanelHeader title="More" onClose={onClose} />
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="space-y-3">
          {boxed.map((it) => (
            <button
              key={it.label}
              onClick={it.onClick}
              className="flex w-full items-center gap-4 rounded-xl bg-[#1E2533] px-4 py-4 text-left transition hover:bg-qx-border"
            >
              <span className="text-white">{it.icon}</span>
              <span className="flex-1 text-[17px] font-bold text-white">{it.label}</span>
              {it.badge && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#2F8FEE] px-1.5 text-[11px] font-bold text-white">
                  {it.badge}
                </span>
              )}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="text-qx-textDim">
                <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ))}
        </div>

        <div className="mt-3">
          {plain.map((it) => (
            <button
              key={it.label}
              onClick={it.onClick}
              className="block w-full px-2 py-3.5 text-left text-[17px] font-medium text-white hover:text-qx-textDim"
            >
              {it.label}
            </button>
          ))}
        </div>

        <div className="mt-2 flex items-center justify-between border-t border-qx-border px-2 pt-5">
          <button
            onClick={() => onAccountSection?.('My account')}
            className="flex items-center gap-2.5 text-[16px] font-semibold text-[#2F8FEE]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.4 13a7.8 7.8 0 000-2l2-1.5-2-3.5-2.4 1a7.7 7.7 0 00-1.7-1L15 3.5h-4l-.3 2.5a7.7 7.7 0 00-1.7 1l-2.4-1-2 3.5L6.6 11a7.8 7.8 0 000 2l-2 1.5 2 3.5 2.4-1a7.7 7.7 0 001.7 1l.3 2.5h4l.3-2.5a7.7 7.7 0 001.7-1l2.4 1 2-3.5zM13 15a3 3 0 110-6 3 3 0 010 6z" />
            </svg>
            Settings
          </button>
          <button onClick={onLogout} className="flex items-center gap-2 text-[16px] font-semibold text-qx-red">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 4h4v16h-4M10 17l5-5-5-5M15 12H3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Logout
          </button>
        </div>
      </div>
    </>
  )
}
