import Link from 'next/link'
import fs from 'node:fs'
import path from 'node:path'
import SiteNavbar from '@/components/site/SiteNavbar'
import SiteFooter from '@/components/site/SiteFooter'

// Live list of APK files in /public/apk (kept across redeploy because the
// folder is tracked in git — see public/apk/.gitkeep). The first .apk found
// becomes the primary download; older versions stay available too.
function listApks() {
  const dir = path.join(process.cwd(), 'public', 'apk')
  try {
    if (!fs.existsSync(dir)) return []
    return fs
      .readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith('.apk'))
      .map((f) => {
        const full = path.join(dir, f)
        const stat = fs.statSync(full)
        return { name: f, url: `/apk/${encodeURIComponent(f)}`, size: stat.size, mtime: stat.mtimeMs }
      })
      .sort((a, b) => b.mtime - a.mtime)
  } catch {
    return []
  }
}

function fmtSize(bytes) {
  if (!bytes) return '—'
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

const FEATURES = [
  { title: 'Real-time charts', desc: 'Currencies, crypto, commodities & stocks — live candle updates.', icon: '📈' },
  { title: 'Up to 95% payout', desc: 'High returns on successful trades across all assets.', icon: '💰' },
  { title: '$10,000 demo', desc: 'Practice risk-free with a fully simulated demo balance.', icon: '🎯' },
  { title: 'Fast withdrawals', desc: 'Simulated instant withdrawals to your preferred method.', icon: '⚡' },
]

const STEPS = [
  { n: 1, title: 'Download the APK', desc: 'Tap the green button above to download the installer file.' },
  { n: 2, title: 'Allow installs from unknown sources', desc: 'Android Settings → Apps → Special access → Install unknown apps → enable your browser.' },
  { n: 3, title: 'Open & install', desc: 'Tap the downloaded file in your notifications or Downloads folder and confirm install.' },
  { n: 4, title: 'Sign in & trade', desc: 'Open the app, log in or create a demo account, and start trading.' },
]

export default function DownloadPage() {
  const apks = listApks()
  const latest = apks[0] || null

  return (
    <div className="relative min-h-screen overflow-hidden bg-qx-bg">
      {/* glow */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 h-[600px] w-[900px] -translate-x-1/2 rounded-full opacity-30 blur-3xl"
        style={{ background: 'radial-gradient(circle, #00C076 0%, transparent 60%)' }}
      />
      <div className="relative z-10">
        <SiteNavbar />

        {/* hero / download */}
        <section className="mx-auto grid max-w-[1400px] items-center gap-10 px-5 py-12 md:grid-cols-2 md:px-10 md:py-20">
          <div>
            <p className="mb-4 inline-block rounded-full bg-qx-green/15 px-4 py-1.5 text-sm font-semibold text-qx-green">
              📱 Mobile app · Android APK
            </p>
            <h1 className="text-4xl font-extrabold leading-tight text-white md:text-6xl">
              Get the <span className="text-qx-green">Quotex</span> app
            </h1>
            <p className="mt-5 max-w-lg text-lg text-qx-textDim">
              Download the Android installer and trade currencies, crypto, commodities and stocks
              with real-time charts — straight from your phone. No Play Store needed.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              {latest ? (
                <a
                  href={latest.url}
                  download={latest.name}
                  className="inline-flex items-center gap-3 rounded-lg bg-qx-green px-8 py-4 text-base font-bold text-white transition hover:bg-qx-greenHover"
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3v12M7 11l5 5 5-5M5 21h14" />
                  </svg>
                  Download APK · {fmtSize(latest.size)}
                </a>
              ) : (
                <button
                  disabled
                  className="inline-flex cursor-not-allowed items-center gap-3 rounded-lg bg-qx-panel2 px-8 py-4 text-base font-bold text-qx-textMute"
                >
                  APK coming soon
                </button>
              )}
              <Link
                href="/en/sign-up"
                className="rounded-lg bg-qx-panel2 px-8 py-4 text-base font-bold text-white transition hover:bg-qx-border"
              >
                Create free account
              </Link>
            </div>

            {/* PWA hint */}
            <p className="mt-5 max-w-lg text-sm text-qx-textMute">
              On iPhone, iPad or desktop? You can also install the web app — open the site in your
              browser, tap <b className="text-qx-textDim">Share → Add to Home Screen</b>.
            </p>
          </div>

          {/* phone mockup */}
          <div className="flex justify-center">
            <div className="relative h-[460px] w-[230px] rounded-[36px] border-4 border-qx-border bg-[#0B1019] p-3 shadow-2xl">
              <div className="absolute left-1/2 top-2 h-5 w-24 -translate-x-1/2 rounded-full bg-qx-border" />
              <div className="flex h-full flex-col items-center justify-center gap-4 rounded-[28px] bg-qx-bg pt-6">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-qx-green/15 text-3xl">📈</div>
                <div className="text-center">
                  <div className="text-lg font-extrabold text-white">Quotex Trade</div>
                  <div className="text-xs text-qx-textDim">Online trading platform</div>
                </div>
                <div className="w-full px-5">
                  <div className="rounded-lg bg-qx-panel2 px-3 py-2 text-center text-sm font-bold text-white">EUR/USD · 1.0854</div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div className="rounded-md bg-qx-green py-2 text-center text-xs font-bold text-white">UP ▲</div>
                    <div className="rounded-md bg-qx-red py-2 text-center text-xs font-bold text-white">DN ▼</div>
                  </div>
                </div>
                {latest && (
                  <div className="rounded-full bg-qx-green px-3 py-1 text-[11px] font-bold text-white">
                    v{new Date(latest.mtime).toISOString().slice(0, 10)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* features */}
        <section className="mx-auto max-w-[1400px] px-5 py-16 md:px-10">
          <h2 className="mb-10 text-center text-3xl font-extrabold text-white md:text-4xl">
            Why traders choose us
          </h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="qx-card p-6">
                <div className="mb-4 text-3xl">{f.icon}</div>
                <h3 className="mb-2 text-lg font-bold text-white">{f.title}</h3>
                <p className="text-sm text-qx-textDim">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* install steps */}
        <section className="mx-auto max-w-[1400px] px-5 pb-16 md:px-10">
          <div className="rounded-2xl bg-qx-panel p-8 md:p-12">
            <h2 className="mb-8 text-center text-3xl font-extrabold text-white md:text-4xl">
              How to install
            </h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s) => (
                <div key={s.n} className="text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-qx-green text-lg font-extrabold text-white">
                    {s.n}
                  </div>
                  <h3 className="mb-2 text-base font-bold text-white">{s.title}</h3>
                  <p className="text-sm text-qx-textDim">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* available versions */}
        {apks.length > 0 && (
          <section className="mx-auto max-w-[1400px] px-5 pb-16 md:px-10">
            <h2 className="mb-6 text-2xl font-extrabold text-white">Available versions</h2>
            <div className="overflow-hidden rounded-xl border border-qx-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-qx-panel2 text-qx-textDim">
                  <tr>
                    <th className="px-4 py-3 font-semibold">File</th>
                    <th className="px-4 py-3 font-semibold">Size</th>
                    <th className="px-4 py-3 font-semibold">Uploaded</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {apks.map((a, i) => (
                    <tr key={a.name} className="border-t border-qx-border">
                      <td className="px-4 py-3 font-semibold text-white">
                        {a.name} {i === 0 && <span className="ml-2 rounded bg-qx-green/20 px-2 py-0.5 text-[11px] font-bold text-qx-green">LATEST</span>}
                      </td>
                      <td className="px-4 py-3 text-qx-textDim">{fmtSize(a.size)}</td>
                      <td className="px-4 py-3 text-qx-textDim">{new Date(a.mtime).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-right">
                        <a href={a.url} download={a.name} className="rounded-lg bg-qx-green px-4 py-2 text-xs font-bold text-white transition hover:bg-qx-greenHover">
                          Download
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <SiteFooter />
      </div>
    </div>
  )
}
