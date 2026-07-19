# Quotex Clone (Simulated)

A pixel-styled clone of the Quotex trading UI built for **local testing & learning only**.
**No real money, no real payments — everything is simulated.**

- **Frontend + REST:** Next.js 14 (App Router)
- **Real-time:** Express + Socket.io (separate process on port 5001)
- **DB:** MongoDB + Mongoose
- **Charts:** lightweight-charts (TradingView)
- **State:** Zustand · **Styling:** Tailwind · **Auth:** JWT (httpOnly cookies) · **PWA:** next-pwa

---

## Features

- Landing, **Sign Up / Log In** (single card with `Login | Registration` toggle, matches Quotex)
- **Trading terminal**: live candlestick chart, asset sidebar (favorites/search/categories),
  trade panel (amount, quick-add, expiry, payout/profit), UP/DOWN with on-chart open lines,
  win/loss flash, real-time open trades + history, **Top Traders** leaderboard
- **Shared price engine** on the server — every user sees the same candles. Each asset has its
  own smooth, momentum-based random walk with a long pre-seeded history you can scroll back.
- **Trade resolution by real price movement** (close vs. open price), not random
- **Deposit / Withdraw** flow (manual proof + admin approval) — JazzCash, EasyPaisa, Bank, USDT
- **Admin panel**: dashboard, deposits, withdrawals, users (ban/adjust balance), assets, settings
- **PWA**: installable on phone/desktop

---

## How Socket.io works here (the part people get stuck on)

Next.js API routes are serverless-style and can't hold a long-lived Socket.io server reliably.
So this project runs **two processes**:

| Process | Port | Role |
| --- | --- | --- |
| Next.js | 3000 | Pages + REST API routes (`/api/*`) + auth cookies |
| Express + Socket.io | 5001 | Live price stream, trade open/resolve, balance pushes |

Both processes connect to the **same MongoDB**, so they share state. `npm run dev` starts both
together via `concurrently`.

**Socket auth across origins:** the JWT lives in an httpOnly cookie scoped to `:3000`, which the
browser can't read or send to `:5001`. So the client calls `GET /api/socket-token` (authenticated
by the cookie) to get a short-lived token, then passes it in the Socket.io handshake
(`auth: { token }`). The WS server verifies it with the same secret. View-only (anonymous)
connections are allowed; trading requires a valid token.

**Protocol:** client `subscribe {symbol, timeframe}` → joins a room → server replies `history`,
then emits `candle` each tick to that room. `summary` (all prices) goes to everyone each tick.
Trades: client emits `open_trade` (ack'd), server debits the stake, schedules the close, and emits
`trade_closed` + `balance` to the user's room on expiry.

---

## Prerequisites

- **Node.js 18+** (tested on Node 22)
- **MongoDB** running locally — *or* use the bundled in-memory fallback (below)

## Setup

```bash
npm install
cp .env.example .env.local   # (Windows: copy .env.example .env.local)  — edit if needed
```

### Run WITH a local MongoDB

```bash
# make sure mongod is running and reachable at MONGODB_URI
npm run seed     # creates admin/user, assets, payment settings
npm run dev      # starts Next.js (3000) + Socket.io server (5001)
```

### Run WITHOUT installing MongoDB (in-memory fallback)

`mongodb-memory-server` is included. Run a fixed-port in-memory Mongo in its own terminal so both
processes share it:

```bash
npm run memdb    # terminal 1 — keep running (data is lost when stopped)
npm run seed     # terminal 2
npm run dev      # terminal 2
```

…or do it all at once:

```bash
npm run dev:mem  # starts memdb + Next.js + Socket.io together
# (run `npm run seed` once after it boots to create the admin/test users)
```

Then open:

- App: <http://localhost:3000>
- Terminal: <http://localhost:3000/en/trade>
- Admin: <http://localhost:3000/admin>

## Default credentials

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@test.com` | `Admin123!` |
| User | `user@test.com` | `User123!` |

(The test user starts with a `$10,000` demo balance. Use the **Cashier → Deposit** flow and approve
it in the admin panel to add a real balance.)

## Install as an app (PWA)

- **Desktop Chrome/Edge:** click the install icon in the address bar, or **Header → Install app**.
- **Android Chrome:** menu → *Install app* / *Add to Home screen*.
- **iOS Safari:** **Share → Add to Home Screen**.

> PWA service worker is disabled in development (`next-pwa`), so install prompts appear after a
> production build (`npm run build && npm start`).

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Next.js + Socket.io (expects MongoDB at `MONGODB_URI`) |
| `npm run dev:mem` | In-memory Mongo + Next.js + Socket.io (zero MongoDB install) |
| `npm run memdb` | Just the in-memory Mongo (fixed port 27017) |
| `npm run seed` | Seed admin/user, assets, payment settings |
| `npm run build` / `npm start` | Production build / start |

## Notes / limitations

- This is a **learning/demo** project. Secrets in `.env.example` are placeholders — change them
  for anything non-local.
- The Socket.io server reads the asset list at startup; restart it after toggling assets in admin.
- Candle history is generated in memory per server boot (not persisted), so restarting the WS
  server reseeds fresh history.
