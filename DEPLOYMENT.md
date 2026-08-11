# Sociafy — Production Deployment Guide

This document describes how to deploy the Sociafy stack (React + Vite frontend,
Node.js + Express + Socket.IO backend, MySQL database). It contains **no real
secrets** — all values are placeholders.

---

## 1. Architecture / hosting topology

```
Browser (HTTPS)
   │  REST:  /api/*          (AJAX → backend origin)
   │  WS:    Socket.IO       (WSS → backend origin, same origin as REST)
   ▼
Frontend host (Vercel / Render static)
   ▼
Backend host (Render / Railway / Fly.io / VPS)
   + Express REST + Socket.IO server
   ▼
MySQL (managed: PlanetScale, AWS RDS, Render PostgreSQL-free tier removed... use any MySQL 8 host)
```

The frontend and backend are deployed separately:
- **Frontend origin**: `https://<frontend-host>` (e.g. Vercel)
- **Backend origin**: `https://<backend-host>` (Node runtime)

Both speak over HTTPS. Socket.IO uses the same backend origin over `wss://`.

---

## 2. Required environment variables

### Backend (`backend/.env`)

| Variable    | Required | Example                          | Notes |
|-------------|----------|----------------------------------|-------|
| `PORT`      | no       | `5000`                           | Server listen port. The platform may override. |
| `DB_HOST`   | **yes**  | `db.example.com`                 | MySQL host. |
| `DB_PORT`   | no       | `3306`                           | MySQL port (default 3306). |
| `DB_USER`   | **yes**  | `app_user`                       | |
| `DB_PASSWORD`| **yes** | *(secret)*                        | |
| `DB_NAME`   | **yes**  | `bluedise`                       | |
| `JWT_SECRET`| **yes**  | 32+ char random string            | **Production startup fails if shorter than 16 characters.** |
| `CORS_ORIGIN`| **yes** | `https://frontend-host`           | Comma-separated. Credentials enabled ⇒ never use `*`. |
| `TRUST_PROXY`| only if proxied | `1` or `true` | Set only when the backend runs behind a proxy (Render/Railway/Cloudflare/Nginx). |

Backend startup refuses to run when a required variable is missing (`DB_HOST`,
`DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`, `CORS_ORIGIN`).

### Frontend

| Variable        | Required | Example                    | Notes |
|-----------------|----------|----------------------------|-------|
| `VITE_API_URL`  | **yes**  | `https://backend-host`     | Backend origin, **no path**. REST uses `${origin}/api`; Socket.IO uses `origin`. **Must not be localhost.** |


The production build **fails** if `VITE_API_URL` is missing **or** points to
`localhost` / `127.0.0.1`.

---

## 3. MySQL configuration

Create an empty database and a user:

```sql
CREATE DATABASE bluedise CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'app_user'@'%' IDENTIFIED BY '<strong-password>';
GRANT ALL PRIVILEGES ON bluedise.* TO 'app_user'@'%';
FLUSH PRIVILEGES;
```

---

## 4. Running migrations (fresh installation)

Migrations are **self-contained** — no `initTables` trickery is required to build
the schema.

```bash
cd backend
cp .env.example .env        # fill in real values
node migrations/cli.js up   # creates/updates the full schema + seeds
```

The migration runner creates every persistent table, completes the `users`
schema, foreign keys, indexes, ENUMs, and required seed data
(`gifts`, `platform_settings`, `admin_wallet`, features).

`initTables` still runs on server boot as a defensive re-check and feature
seeder; it is idempotent and does not conflict with an already-migrated schema.

---

## 5. Starting the backend

```bash
cd backend
NODE_ENV=production node src/server.js
```

- Production startup fails fast if required env vars are missing or
  `JWT_SECRET` is too short.
- `CORS_ORIGIN` must list the real frontend origin (and your own dev origins if
  you still need them).

---

## 6. Building the frontend

```bash
# Fed by .env.production or the deploy env:
#   VITE_API_URL=https://backend-host
npm run build        # outputs to dist/
```

Deploy `dist/` (e.g. Vercel/Render static). Make sure the host rewrites unknown
routes to `index.html` (SPA). A `vercel.json` SPA rewrite is already included.

---

## 7. CORS configuration

- Backend reads `CORS_ORIGIN` (comma-separated). Express REST and Socket.IO use
  the **same** list.
- Credentials are enabled; allowed origins are explicit — never `*`.
- No-origin requests (server-to-server, curl) are allowed.

---

## 8. Socket.IO configuration

- The client connects to the same origin as REST via `SOCKET_URL` (derived from
  `VITE_API_URL`). Over HTTPS it uses `wss://` automatically — the frontend never
  forces insecure `ws://` / `http://`.
- Socket auth uses the same JWT sent in the client handshake (`auth.token`).
- Rate limits protect `gift:send`, `call:*` state events, and chat messages —
  WebRTC signaling (`offer`, `ice-candidate`) is not throttled.

---

## 9. Reverse proxy / TRUST_PROXY

- IP-based rate limits (login/register) use the client IP.
- If the backend sits behind a proxy (Render/Railway/Cloudflare/Nginx), set
  `TRUST_PROXY` so `req.ip` is the real client and rate limits cannot be bypassed
  by spoofing `X-Forwarded-For`.
  - `TRUST_PROXY=1` for a single proxy hop (Render/Railway/Fly).
  - `TRUST_PROXY=true` only when every request arrives through the trusted proxy.
- Do **not** set it when there is no proxy (direct bind).

---

## 10. Upload storage (IMPORTANT)

`/uploads` is **local filesystem** storage (avatars, deposits screenshots, post
images).

- **Vercel / Render / Fly.io**: the filesystem is **ephemeral** — files are lost
  on restart and not shared across instances.
- **Before launch you must add object storage** (S3, Cloudflare R2, Backblaze B2)
  and change the upload middleware to write there instead of `./uploads`.
  This is a **deployment blocker** for a durable, multi-instance production.

If you accept a single-instance deployment with a persistent disk VOLUME,
`/uploads` works, but that is operator-managed. Do **not** assume it on an
ephemeral platform.

---

## 11. HTTPS

- The hosting platform terminates TLS. Backend should be reached over HTTPS.
- Helmet is enabled (`Content-Security-Policy` intentionally off so WebRTC,
  external fonts, and uploads keep working). HSTS is on when served over HTTPS.

---

## 12. Fresh-installation checklist

1. Create MySQL DB + user, run `backend/migrations/... up`.
2. Set backend env (see §2), start with `NODE_ENV=production`.
3. Set frontend `VITE_API_URL` to the real backend origin; `npm run build`.
4. Deploy `dist/`; set CORS_ORIGIN to the frontend host.
5. (Required before launch) Replace `/uploads` with object storage.
6. Seed the admin account (either `seed-admin.js` or via DB) and change its
   password immediately.