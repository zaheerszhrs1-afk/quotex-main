import QuotexLogo from '@/components/ui/QuotexLogo'

function Social({ label, count, color, children }) {
  return (
    <div
      className="flex items-center gap-3 rounded-lg px-4 py-2.5"
      style={{ background: 'rgba(59,130,246,0.08)' }}
    >
      <span style={{ color }}>{children}</span>
      <span className="text-sm font-semibold text-[#5B9BFF]">{count}</span>
    </div>
  )
}

function StoreBadge({ top, bottom, href }) {
  return (
    <a href={href} className="flex w-[180px] items-center gap-3 rounded-lg bg-black px-4 py-2 transition hover:bg-black/80">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="white">
        <path d="M3 2.5v19l16-9.5z" opacity="0.9" />
      </svg>
      <div className="leading-tight">
        <div className="text-[10px] uppercase text-white/70">{top}</div>
        <div className="text-base font-semibold text-white">{bottom}</div>
      </div>
    </a>
  )
}

export default function SiteFooter() {
  return (
    <footer className="mt-20 px-5 pb-10 md:px-10">
      <div className="mx-auto max-w-[1600px]">
        <div className="rounded-2xl bg-[#0B1019] p-8 md:p-12">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:grid-cols-5">
            <div className="col-span-2 md:col-span-1">
              <QuotexLogo />
            </div>
            <div>
              <h4 className="mb-4 flex items-center gap-1 font-bold text-white">FAQ ›</h4>
              <ul className="space-y-3 text-[15px] text-[#8A93A6]">
                <li>General questions</li>
                <li>Financial questions</li>
                <li>Verification</li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 flex items-center gap-1 font-bold text-white">About us ›</h4>
              <ul className="space-y-3 text-[15px] text-[#8A93A6]">
                <li>Contacts</li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 font-bold text-white">More</h4>
              <ul className="space-y-3 text-[15px] text-[#8A93A6]">
                <li>Demo account</li>
                <li>Affiliate program ↗</li>
              </ul>
            </div>
            <div className="col-span-2 md:col-span-1">
              <p className="mb-3 text-sm text-[#8A93A6]">Download the app</p>
              <div className="space-y-3">
                <StoreBadge top="Download" bottom="Android APK" href="/apkdownload" />
                <StoreBadge top="Progressive" bottom="Web App" href="/apkdownload" />
              </div>
              <p className="mb-3 mt-6 text-sm text-[#8A93A6]">Follow us on social media</p>
              <div className="space-y-2">
                <Social count="10K+" color="#1877F2">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M13 10h3l.5-3H13V5.5c0-.8.2-1.5 1.5-1.5H16V1.2C15.7 1.1 14.7 1 13.6 1 11.2 1 9.5 2.5 9.5 5.1V7H7v3h2.5v9H13z"/></svg>
                </Social>
                <Social count="76K+" color="#E1306C">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>
                </Social>
                <Social count="90K+" color="#229ED9">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M21.5 4L2.5 11.5l5 1.8 2 6 2.7-3.3 4.8 3.5z"/></svg>
                </Social>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-8 px-2 md:grid-cols-[200px_1fr]">
          <ul className="space-y-3 text-[15px] text-[#8A93A6]">
            <li className="font-bold text-white">Regulations</li>
            <li>Privacy policy</li>
            <li>Service agreement</li>
            <li>Risk disclosure</li>
            <li>Rules of trading operations</li>
          </ul>
          <div className="space-y-4 text-[13px] leading-relaxed text-[#6B7484]">
            <p>ON SPOT GROUP LLC. Address: Main Street, P.O. Box 625, Charlestown, St. Kitts and Nevis.</p>
            <p>
              The website services are not available in a number of countries, including USA, Canada,
              Hong Kong, EEA countries, Israel, Russia as well as for persons under 18 years of age.
            </p>
            <p>
              Risk Warning: Trading Forex and Leveraged Financial Instruments involves significant risk
              and can result in the loss of your invested capital. Past performance is no guarantee of
              future results.
            </p>
            <p className="text-[#566273]">
              This is a UI clone built for local testing and learning only — no real money, no real
              payments, everything is simulated.
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
