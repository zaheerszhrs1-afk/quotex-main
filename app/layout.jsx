import './globals.css'

export const metadata = {
  title: 'Quotex — Online Trading Platform',
  description: 'Quotex UI clone for local testing & learning (simulated, no real money).',
  // NOTE: `manifest` is intentionally NOT set here. The Next.js App Router injects
  // <link rel="manifest" crossorigin="use-credentials">, which makes PWA/APK
  // packagers (PWABuilder, Bubblewrap) fetch the manifest WITH cookies and then
  // fail to read it — reporting fields like "description" as missing. We add the
  // manifest link manually below without crossorigin so it is publicly readable.
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
}

export const viewport = {
  themeColor: '#00C076',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        {/* Manifest linked manually (no crossorigin) so PWA/APK packagers can read it */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Trade" />
      </head>
      <body>{children}</body>
    </html>
  )
}
