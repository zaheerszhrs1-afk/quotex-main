# Deploying to Dokploy (with MongoDB Atlas)

This app runs **two processes** from one repo:

| Process | Port | Purpose |
| --- | --- | --- |
| Next.js (`next start`) | 3000 | Pages + REST API |
| Express + Socket.io | 5001 | Live prices, trades, balances |

The included `Dockerfile` runs **both** in one container via `npm start` and `EXPOSE`s
both ports. In Dokploy you don't expose ports to the host — instead you add **domains**
whose **Container Port** field tells Traefik which internal port to route to. You add one
domain entry per port (see below).

> ℹ️ **About the "3000 default":** when you create a domain in Dokploy, the **Container Port**
> field defaults to `3000`, but it's editable. It only controls Traefik's internal routing —
> it does **not** publish the port to the internet. (That's the separate *Advanced → Ports*
> section, which you should **not** use here — host port mappings cause conflicts.)
> So to reach the websocket on 5001, you just add a second domain entry with Container Port `5001`.

> ⚠️ **`NEXT_PUBLIC_WS_URL` is baked into the browser bundle at BUILD time.** It must be
> set as a build-time variable, not just runtime. Dokploy passes the app's environment
> variables as Docker **build args**, and the `Dockerfile` reads it via `ARG`. If you change
> it later you must **rebuild/redeploy**, not just restart.

---

## 1. MongoDB Atlas

1. Create a free cluster at https://cloud.mongodb.com.
2. **Network Access → Add IP** → allow your Dokploy server's IP (or `0.0.0.0/0` for testing).
3. **Database Access → Add user** (username + password).
4. Copy the connection string, e.g.:
   ```
   mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/quotex-clone?retryWrites=true&w=majority
   ```
   (Keep the `/quotex-clone` db name.)

## 2. Create the app in Dokploy

1. **Create → Application** → connect this Git repo (or push the image).
2. **Build Type: Dockerfile** (Dokploy auto-detects the `Dockerfile`).

## 3. Domains (the important part)

Both processes run in the **one** container; you route to each port by adding a domain
entry in the app's **Domains** tab (**Create Domain**, repeat for the second). Pick **one**
of the two layouts below.

Dokploy's Traefik proxy upgrades WSS automatically — no extra labels/config needed.

### Option B — single domain, path-based (recommended)

Socket.io always uses the `/socket.io` path, so route just that path to port 5001 and
everything else to 3000. No subdomain required.

| Host | Path | Container Port | HTTPS |
| --- | --- | --- | --- |
| `app.yourdomain.com` | `/` | `3000` | on |
| `app.yourdomain.com` | `/socket.io` | `5001` | on |

Traefik matches the more specific path (`/socket.io`) first. Then set:

```
NEXT_PUBLIC_WS_URL=https://app.yourdomain.com
CLIENT_ORIGIN=https://app.yourdomain.com
```

### Option A — two subdomains

| Host | Path | Container Port | HTTPS |
| --- | --- | --- | --- |
| `app.yourdomain.com` | `/` | `3000` | on |
| `ws.yourdomain.com`  | `/` | `5001` | on |

Then set:

```
NEXT_PUBLIC_WS_URL=https://ws.yourdomain.com
CLIENT_ORIGIN=https://app.yourdomain.com
```

## 4. Environment variables

Set these in the app's **Environment** tab (Dokploy uses them at build **and** runtime):

```
# --- baked at build time (must be set before/at build) ---
# Option B (single domain): use the web domain. Option A: use https://ws.yourdomain.com
NEXT_PUBLIC_WS_URL=https://app.yourdomain.com

# --- runtime ---
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/quotex-clone?retryWrites=true&w=majority
JWT_SECRET=<long-random-string>
JWT_REFRESH_SECRET=<another-long-random-string>
WS_PORT=5001
CLIENT_ORIGIN=https://app.yourdomain.com
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=<strong-password>
```

- `CLIENT_ORIGIN` must equal the **web** domain — the Socket.io server uses it for CORS.
- `NEXT_PUBLIC_WS_URL`: with **Option B** it's the same web domain; with **Option A** it's the `ws.` subdomain.
- If you change `NEXT_PUBLIC_WS_URL` later, you must **rebuild** (it's compiled in).

## 5. Persist uploads (optional)

Deposit screenshots are written to `/app/public/uploads`, which is ephemeral. In Dokploy
add a **Volume mount**: host volume → `/app/public/uploads` so they survive redeploys.

## 6. Deploy, then seed

1. Click **Deploy**. Wait for build + start.
2. Visit `https://app.yourdomain.com` — it should load.
3. **Seed the admin/user/assets once.** Easiest: in Dokploy open the app's
   **Terminal/Console** and run:
   ```
   npm run seed
   ```
   (Or run it locally once against the same Atlas `MONGODB_URI`.)
4. Log in at `https://app.yourdomain.com/en/sign-in` with your `ADMIN_EMAIL`/`ADMIN_PASSWORD`.

## 7. Verify the websocket

Open the trade page and check the browser **Network** tab → filter `socket.io`. The
connection should show **101 Switching Protocols** (to `app.yourdomain.com/socket.io` for
Option B, or `ws.yourdomain.com/socket.io` for Option A). If the chart is empty:
- `NEXT_PUBLIC_WS_URL` was wrong at build time → fix it and **redeploy** (rebuild).
- `CLIENT_ORIGIN` doesn't match the web domain → CORS blocks the socket.
- The `/socket.io` path (Option B) or `ws` subdomain (Option A) isn't routed to port `5001`.

---

## Alternative: two separate Dokploy apps

If you prefer isolation, deploy the same repo twice:

- **web app** → start command `npm run next` (or `next start`), domain → 3000.
- **ws app** → start command `npm run server` (`node server/index.js`), domain → 5001.

Both use the **same** `MONGODB_URI`. Set `NEXT_PUBLIC_WS_URL` (build arg) on the web app to
the ws app's public URL, and `CLIENT_ORIGIN` on the ws app to the web app's URL. This scales
the two independently but uses two build pipelines.
