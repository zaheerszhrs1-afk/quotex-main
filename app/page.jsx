// Home page is intentionally not reachable — middleware redirects / to
// /en/sign-in (or /en/trade if already logged in) before this renders.
// This file exists only so Next.js doesn't 404 on the root route.
export default function Home() {
  return null
}
