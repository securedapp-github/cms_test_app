# SecureDApp CMS

Multi-tenant consent management system (DPDP-oriented): Google login, onboarding, purposes, policy versions, consent event sourcing, audit logs, API keys, public consent API, and webhooks.

**Stack:** Node.js, Express, MySQL, Sequelize.

**Production API (SecureDApp):** `https://cmsbe.securedapp.io` — hostname is **cmsbe** (no hyphen), not `cms-be`.

**Demo integration UI** (unified consent / webhooks / redirect) lives in **`demo-apps/unified-demo/`** in this repo. Run `npm run demo:install` then `npm run demo:all` from the root (see `demo-apps/README.md`).

### Production: SPA (`cms-app`) vs API (`cmsbe`)

The **browser must call the API host**, not the static SPA host. If login requests go to `https://cms-app.securedapp.io/...` you get **404** — that server only serves HTML/JS. Point the SPA’s API base URL to **`https://cmsbe.securedapp.io`** (e.g. `VITE_API_URL` or equivalent at build time). Use **`POST /auth/google-login`** or **`POST /api/auth/google-login`** with JSON `{ "googleToken": "<credential>" }`.

On **cmsbe**, set **`CORS_ORIGIN`** to the SPA origin (e.g. `https://cms-app.securedapp.io`) so credentialed requests succeed.

**`vite.svg` 404:** add the file under the SPA’s `public/` or remove the `<link>` from `index.html` (cosmetic).

**COOP / Google popup:** this API disables Helmet’s `Cross-Origin-Opener-Policy` for GIS. If you still see COOP errors, check that **nginx/CDN** in front of **cmsbe** is not adding `Cross-Origin-Opener-Policy`.

**`google.accounts.id.initialize()` twice:** usually React **Strict Mode** double-mounting; guard with a ref or initialize once at app root.

---

## Prerequisites

- **Node.js** 18+ (LTS recommended)
- **MySQL** 8.x (or 5.7)
- **Redis** (for webhook queue; optional if you don’t use webhooks)
- **Google Cloud Console** – OAuth 2.0 Client ID (Web application) for Google login

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/scorpionus007/securedapp_cms.git
cd securedapp_cms
npm install
```

### 2. Environment variables

**Do not commit `.env`.** The repo includes `.env.example` only. Copy it and fill in your values:

```bash
cp .env.example .env
```

Edit `.env` and set:

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth 2.0 Client ID (Web application) |
| `JWT_SECRET` | Yes | Secret for signing JWTs (min 32 characters). Use e.g. `openssl rand -base64 32` |
| `DB_HOST` | Yes | MySQL host (e.g. `localhost`) |
| `DB_PORT` | No | Default `3306` |
| `DB_NAME` | No | Default `securedapp_cms` |
| `DB_USER` | Yes | MySQL user |
| `DB_PASSWORD` | Yes | MySQL password |
| `JWT_EXPIRES_IN` | No | Default `7d` |
| `PORT` | No | Server port, default `3000` |
| `NODE_ENV` | No | `development` or `production` |
| `LOG_LEVEL` | No | Winston: `error`, `warn`, `info`, `debug` (default: info in prod, debug in dev) |
| `LOG_DIR` | No | If set, write `combined.log` and `error.log` (e.g. `logs`) |
| `RATE_LIMIT_WINDOW_MS` | No | Rate limit window in ms (default 900000 = 15 min) |
| `RATE_LIMIT_MAX_GENERAL` | No | Max requests per window for general API (default 200) |
| `RATE_LIMIT_MAX_AUTH` | No | Max login attempts per window (default 10) |
| `RATE_LIMIT_MAX_PUBLIC` | No | Max requests per window for public/API-key routes (default 60) |
| `CORS_ORIGIN` | No | Comma-separated origins (production) |
| `DB_LOGGING` | No | Set to `true` to log SQL (dev only) |
| `REDIS_ENABLED` | No | Set to `true` to enable Redis for webhook queue (default: off) |
| `REDIS_HOST` | No | Redis host for webhook queue (default `127.0.0.1`) |
| `REDIS_PORT` | No | Redis port (default `6379`) |
| `SMTP_HOST` | No | SMTP server host (used for redirect-consent OTP email) |
| `SMTP_PORT` | No | SMTP server port (default `587`) |
| `SMTP_SECURE` | No | `true` for SMTPS (usually `465`), else `false` |
| `SMTP_USER` | No | SMTP username |
| `SMTP_PASS` | No | SMTP password / app password |
| `SMTP_FROM_EMAIL` | No | Sender email address for OTP mail |
| `SMTP_FROM_NAME` | No | Sender display name (default `SecureDApp CMS`) |

### 3. Database

Create the MySQL database (if it doesn’t exist):

```bash
npm run db:create
```

Sync tables and apply migrations:

```bash
npm run db:sync
```

`db:sync` also **upserts the platform data catalog** (required data elements for purposes). On **`npm start`** (production), the same defaults run automatically on boot so a fresh deploy is not empty. Optional: `npm run db:seed-catalog` or set `SKIP_CATALOG_SEED=true` to skip startup seeding.

### 4. Run

```bash
npm start
# or with file watch — also runs DB sync (`db:sync`) automatically on startup
npm run dev
```

Set `SKIP_DB_SYNC=true` in `.env` if you want faster restarts without syncing each time.

Server runs at **http://localhost:3000** (or your `PORT`). Swagger UI: **http://localhost:3000/api-docs**. In production, the API is served at **https://cmsbe.securedapp.io**.

### 5. Webhooks (async queue)

Webhook delivery is offloaded to a **BullMQ queue + Redis**. The API only enqueues jobs; a separate worker sends HTTP requests and records deliveries.

**Redis is off by default.** The API starts without Redis; webhook dispatch no-ops until you enable it.

**To use webhooks:**
1. Install and start **Redis** (e.g. locally on port 6379).
2. Set `REDIS_ENABLED=true` in `.env` (and `REDIS_HOST` / `REDIS_PORT` if needed).
3. Run the webhook worker in a separate process:

```bash
npm run worker:webhook
```

Keep the worker running alongside the API. Failed deliveries are retried (exponential backoff); after 5 failures the attempt is recorded in `webhook_deliveries` with `status: failed` (dead letter).

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start server |
| `npm run dev` | Start with `--watch`; **auto-runs `db:sync` first** (unless `SKIP_DB_SYNC=true`) |
| `npm run db:create` | Create MySQL database from `DB_*` |
| `npm run db:sync` | Sync/alter tables (Sequelize); same logic as dev auto-sync |
| `npm run db:clear` | Truncate all data (dev only; requires `CLEAR_DB_CONFIRM=yes`) |
| `npm run db:fix-clients-name` | Add `clients.name` column if missing |
| `npm run worker:webhook` | Run webhook delivery worker (requires Redis) |

---

## API overview

- **Auth:** Google login → JWT (onboarding or full). Use `Authorization: Bearer <token>` for protected routes.
- **Tenant:** Onboard (`POST /tenant/onboard`), get current tenant (`GET /tenant/me`), API keys (`/tenant/api-keys`).
- **Consent:** Grant/withdraw and read state (JWT or public API with API key).
- **Purposes, policy versions, audit logs, webhooks:** See Swagger at `/api-docs` or `docs/API_AND_ARCHITECTURE.md`.

**Public API (API key):** `x-api-key` header; base path `/public` (consent grant/withdraw, purposes, policy, verify).

---

## Security

- Never commit `.env` or any file containing secrets.
- Use strong `JWT_SECRET` and keep it server-side only.
- In production, set `NODE_ENV=production` and configure `CORS_ORIGIN` and HTTPS.

---

## License

Private / use as per your organization’s terms.
