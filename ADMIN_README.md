# Admin Section — Handoff / Reference

This document is the source of truth for the **admin panel** and the custom
**trade-control system** (force outcomes, manual candle steering, automatic
"house always profits" engine). Read this first in a new session.

---

## 1. Architecture (important)

There are **two separate Node processes** (run together via `npm run dev`):

| Process | What it is | File |
|---|---|---|
| **Next.js** | Admin UI pages + REST APIs (auth, deposits, users, settings…) | `app/**` |
| **WS server** | Express + Socket.io; the live **price engine** + **trade resolver** + all real-time admin control | `server/index.js` |

- The **price engine and resolver live ONLY in the WS process** (in memory).
- Admin real-time control (force / candle / auto-profit) flows **admin browser → Socket.io → WS process memory**. **No DB in the hot loop.**
- Persisted admin settings are saved to Mongo **only on admin click** (rare), loaded on WS boot.

> ⚠️ **`server/*.js` changes do NOT hot-reload.** After editing `server/index.js`, `server/tradeResolver.js`, or `server/priceEngine.js`, you must **restart `npm run dev`**. Next.js pages/APIs hot-reload normally.

---

## 2. Admin auth & access

| File | Purpose |
|---|---|
| `app/admin/sign-in/page.jsx` | Dedicated **admin login** page (`/admin/sign-in`). Renders `AuthPage mode="login" admin`. |
| `components/site/AuthCard.jsx` | Login/signup card. `admin` prop → posts `{ scope:'admin' }`, hides registration/Google, redirects to `/admin`. |
| `app/api/auth/login/route.js` | When `scope==='admin'` and user is **not** admin → 403. Admins are redirected to `/admin` even from the normal login. |
| `components/admin/AdminShell.jsx` | Admin layout + **guard** (non-admins → `/admin/sign-in`) + sidebar (desktop) / sticky top nav (mobile). **Skips guard on `/admin/sign-in`.** Holds the `NAV` array (add new admin pages here). |
| `app/admin/layout.jsx` | Wraps all `/admin/*` in `AdminShell`. |
| `lib/requireAdmin.js` | `requireAdmin(request)` — used by every `/api/admin/*` route; returns admin user or null. |
| `lib/serverAuth.js` | `getUserFromRequest` — reads JWT access cookie → user. |
| `lib/auth.js` | JWT sign/verify, cookie helpers. Access token has `{ sub, role }`. |

The **socket** also authenticates: `server/index.js` reads `socket.handshake.auth.token` (from `/api/socket-token`), sets `socket.data.isAdmin = payload.role === 'admin'`, and joins the `admins` room. All `admin:*` socket events check `socket.data.isAdmin`.

---

## 3. Admin pages (`app/admin/`)

| Route | File | Purpose |
|---|---|---|
| `/admin` | `app/admin/page.jsx` | Dashboard: stats cards + **House P&L panel** (real-money net/wagered/win-rate over today/7d/30d/all) + recent deposits/withdrawals. |
| `/admin/live` | `app/admin/live/page.jsx` | **Live trades monitor** (real-time via socket) + **real-money exposure/risk panel** (per-asset UP/DOWN stake + worst-case house liability) + **per-trade** and **per-user** Force WIN/LOSS/AUTO buttons. |
| `/admin/audit` | `app/admin/audit/page.jsx` | **Audit log**: every sensitive admin action (balance edits, bans, role changes, deposit/withdrawal decisions, forced trades/users), newest first, filterable by action. |
| `/admin/candles` | `app/admin/candles/page.jsx` | **Candle control**: future-candle preview chart, manual Force UP/DOWN/target, and the **Auto-profit engine** toggles (ALL assets / per-asset / Smart-Max / Real-only-vs-Demo+Real). |
| `/admin/users` | `app/admin/users/page.jsx` | Users table: ban/unban, **make/remove admin**, edit balances. Admin never sees self. |
| `/admin/deposits` | `app/admin/deposits/page.jsx` | Approve/reject deposit requests. |
| `/admin/withdrawals` | `app/admin/withdrawals/page.jsx` | Approve/reject withdrawal requests. |
| `/admin/assets` | `app/admin/assets/page.jsx` | Enable/disable assets, payout, base price. |
| `/admin/tournaments` | `app/admin/tournaments/page.jsx` | CRUD tournaments. |
| `/admin/settings` | `app/admin/settings/page.jsx` | **Payment methods** (add/remove, category, logo, min amount, popular), min deposit/withdrawal, announcement, "Reset to defaults". |

---

## 4. Admin REST APIs (`app/api/admin/`)

All guarded by `requireAdmin`.

| File | Purpose |
|---|---|
| `app/api/admin/stats/route.js` | Dashboard stats. |
| `app/api/admin/users/route.js` | GET users (**excludes the admin's own account**). Supports `?page=&limit=&q=` (default 20/page, `q` searches email). |
| `app/api/admin/users/[id]/route.js` | PATCH: `ban` / `setRole` (admin↔user, can't change self) / `setBalance`. |
| `app/api/admin/deposits/route.js`, `.../[id]/route.js` | List + approve/reject (credits balance). Supports `?page=&limit=&status=`. |
| `app/api/admin/withdrawals/route.js`, `.../[id]/route.js` | List + approve/reject (refunds on reject). Supports `?page=&limit=&status=`. |
| `app/api/admin/assets/route.js`, `.../[id]/route.js` | Asset management. Supports `?page=&limit=`. |
| `app/api/admin/tournaments/route.js`, `.../[id]/route.js` | Tournament management. Supports `?page=&limit=`. |
| `app/api/admin/settings/route.js` | GET/PUT payment settings; `action:'resetMethods'`. |
| `app/api/admin/pnl/route.js` | GET house P&L (real-money) over today/7d/30d/all windows. |
| `app/api/admin/audit/route.js` | GET audit-log entries (`?page=&limit=&action=`, default 20/page). |

### Audit logging

- `lib/models/AdminAudit.js` — append-only log: `{ adminId, adminEmail, action, target, summary, meta, createdAt }`.
- `lib/auditLog.js` — `logAdmin({...})`, never throws (auditing must not break the action).
- Wired into: user ban/role/balance, deposit approve/reject, withdrawal approve/reject (Next.js routes), and **forced trade / forced user** (WS process, `server/index.js` — needs a `npm run dev` restart to take effect).

---

## 5. The trade-control system (the custom part)

Three layers, all built on the same admin-socket backbone. **All in-memory; settings persisted to `AdminControl`.**

### 5a. Files

| File | Purpose |
|---|---|
| `server/index.js` | WS server. Socket auth, `admins` room, **all `admin:*` event handlers**, the 250ms tick loop, per-second pushes to admins, calls `resolver.runAuto()`. |
| `server/tradeResolver.js` | Open-trades registry (memory), **trade resolution**, **force control** (per-trade + per-user), **auto-profit engine** (`lossMaxTarget`, `runAuto`), **persistence** (`loadControl`/`saveControl`). |
| `server/priceEngine.js` | Price generation + **future-plan buffer** + **candle steering** (`setCandleOverride`) + **auto target steering** (`setAutoTarget`/`clearAutoTarget`, decisive pull in `_stepPlanHead`) + admin preview (`getAdminSeries`/`getFutureCandles`). |
| `lib/models/AdminControl.js` | Mongoose **singleton** persisting admin settings: `autoAll, strict, countDemo, autoAssets[], userForce{}`. |
| `lib/socketClient.js` | Browser socket; `auth` callback fetches a **fresh token on every (re)connect** (fixes prod "Please log in to trade"). |
| `app/api/socket-token/route.js` | Mints a short-lived socket token (falls back to refresh cookie). |

### 5b. Admin socket events (browser → WS)

| Event | Payload | Effect |
|---|---|---|
| `admin:trades` (server→admin) | open trades array | Live monitor feed (pushed every 1s + on open/close). |
| `admin:force_trade` | `{ tradeId, result }` | Force one trade `win`/`loss`/`normal`. **One-shot.** |
| `admin:force_user` | `{ userId, mode }` | Force all of a user's future trades `win`/`loss`/`normal`. Persisted. |
| `admin:watch_plan` | `{ symbol, timeframe }` | Subscribe to the future-plan preview for an asset. |
| `admin:plan` (server→admin) | series | past + forming + **future** candles + overrides + `auto/autoAll/strict/countDemo` flags + `autoTarget`. |
| `admin:set_candle` | `{ symbol, timeframe, direction, strength, target, which }` | Manually steer a future candle (chart-consistent). |
| `admin:clear_plan` | `{ symbol }` | Drop manual overrides → back to random. |
| `admin:auto_asset` | `{ symbol, on }` | Auto-profit for one asset. |
| `admin:auto_all` | `{ on }` | **Master** auto-profit for every asset with open trades. |
| `admin:auto_mode` | `{ strict }` | `false`=Smart (realistic), `true`=Max (squeeze). |
| `admin:auto_count_demo` | `{ on }` | `true`=demo+real, `false`=real-money only. |

### 5c. How resolution works (`resolveTrade` in tradeResolver.js)

Priority order:
1. **Per-trade force** (`forcedTrades`) — beats everything, one-shot.
2. **Per-user force** (`userForce`).
3. **Price** comparison (`closePrice` vs `openPrice`; tie = loss = house edge).
4. **Smart realism leak**: if Smart mode + asset is auto-steered + trade would lose purely from steering, ~20% (`REALISM_WIN_RATE`) are allowed to win so it's not an obvious 100% wipeout. (Skipped in Max mode; never overrides explicit force.)

### 5d. Auto-profit engine (`lossMaxTarget` + `runAuto`)

- Every 1s, for each auto asset, computes the close price that **maximizes house profit** (= users' max loss), **money + payout weighted** (not count).
- `houseNet(x)` is a step function of price; candidates tested = below all opens, **midpoint of every gap** (so opposite-direction pairs can BOTH lose), above all opens.
- `engine.setAutoTarget(symbol, target)` steers the price there decisively (strong pull + damped momentum + light noise in `priceEngine._stepPlanHead`).
- Edge cases handled: no trades → random; one-sided crowd → that side loses (Smart leaks ~20% wins); opposite dirs → both-lose midpoint or heavier-money side; trade close/open → reconcile clears stale targets; `countDemo` filters demo.

### 5e. Future-plan buffer (`priceEngine.js`)

- Engine pre-generates each asset's price path **~90s ahead** in memory (`PLAN_AHEAD_MS`).
- `tick()` realizes the planned price for "now" → users see it in real time; **admin sees the future** via `getAdminSeries` (blue candles in `/admin/candles`).
- Manual `setCandleOverride` and auto `setAutoTarget` reshape this plan.

---

## 6. Persistence (survives restart / logout)

- `lib/models/AdminControl.js` singleton stores: `autoAll, strict, countDemo, autoAssets[], userForce{}`.
- `resolver.loadControl()` runs on WS boot (called in `server/index.js`).
- `resolver.saveControl()` runs on each admin setter (`setAuto/setAutoAll/setStrict/setCountDemo/setUserForce`) — **fire-and-forget, not in the hot loop**.
- **Not persisted:** per-trade force (`forcedTrades`) — it's ephemeral/one-shot.

---

## 7. Run & test

```bash
npm run dev      # Next.js + WS server together
npm run seed     # admin@test.com / Admin123!, user@test.com / User123!, assets, payment methods
```

- Admin login: `/admin/sign-in`.
- **After any `server/*.js` change: restart `npm run dev`.**
- Test auto-profit: `/admin/candles` → "ALL assets" ON → place trades → terminal shows `[RESOLVE] ... WIN/LOSS`.

### Debug logs currently in `server/tradeResolver.js`
- `[control] loaded admin settings …` (boot)
- `[AUTO] master ALL = …` (toggle)
- `[RESOLVE] SYMBOL dir acct=… open=… close=… -> WIN/LOSS (forced=…, autoTarget=…)` (every resolve)

> These are intentional for debugging. **Remove them before production** once behaviour is confirmed.

---

## 8. Known gotchas

- `server/*.js` is **not** hot-reloaded — restart required.
- Auto-profit only steers assets that have **open trades** (and, if `countDemo=false`, only real-money ones).
- One shared price per asset → steering affects everyone on that asset (demo rides along).
- Flexbox overflow: admin content wrapper uses `min-w-0` (`AdminShell.jsx`) so pages don't force horizontal scroll; wide tables scroll inside their own `overflow-x-auto` card.
