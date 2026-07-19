const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  // Never cache API calls in the service worker. These are auth-dependent and
  // real-time (tokens, balances, trades); a stale cached response was causing
  // the socket to re-authenticate with an expired token in production.
  runtimeCaching: [
    {
      urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/api/'),
      handler: 'NetworkOnly',
    },
    // sensible offline caching for everything else (mirrors next-pwa defaults)
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff2?|ttf|otf|eot|css|js)$/i,
      handler: 'StaleWhileRevalidate',
      options: { cacheName: 'static-assets', expiration: { maxEntries: 128, maxAgeSeconds: 86400 } },
    },
    {
      urlPattern: ({ url, sameOrigin }) => sameOrigin && !url.pathname.startsWith('/api/'),
      handler: 'NetworkFirst',
      options: { cacheName: 'pages', networkTimeoutSeconds: 10, expiration: { maxEntries: 64, maxAgeSeconds: 86400 } },
    },
  ],
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // Screenshots / uploaded deposit proofs are served from /public/uploads
  images: {
    remotePatterns: [{ protocol: 'http', hostname: 'localhost' }],
  },
  // Single-process webpack build avoids an intermittent "Cannot find module
  // './NNN.js'" chunk race during page-data collection on Windows (next-pwa).
  experimental: {
    webpackBuildWorker: false,
  },
}

module.exports = withPWA(nextConfig)
