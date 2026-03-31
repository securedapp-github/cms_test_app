# Unified CMS demo (1 backend + 1 UI)

Combines:

- **Consent (embedded)** — grant/withdraw via CMS public API (credentials from the UI or optional `.env` fallbacks)
- **Webhooks (ERP)** — receive CMS webhook calls and inspect payloads/signatures
- **Redirect consent** — redirect URL + OTP popup

## Production-style deploy

Deploy the Node API and static UI **once**. Operators open the UI and fill **CMS connection** (saved in **localStorage** in that browser only):

- CMS base URL → `x-cms-base-url`
- Tenant public API key → `x-api-key`
- App UUID → `x-app-id`

The demo API forwards those headers to your CMS on each request. **Do not treat the browser as secret storage** — the API key is visible in DevTools; this pattern is for demos and internal tools.

**Server environment** can be minimal:

- `PORT` — listen port
- `PUBLIC_DEMO_API_URL` — if you sit behind a reverse proxy, set the public `https://…` base of this API so **Resolved config** shows the correct webhook URL; otherwise it is inferred from `Host` / `X-Forwarded-*`
- `ERP_WEBHOOK_SECRET` — optional; verifies incoming webhook signatures from CMS

You do **not** need `CMS_*` in production if every user configures the connection in the UI.

## Local dev

1. CMS API: `npm start` in monorepo root (e.g. `:3000`).
2. Optional: copy `backend/.env.example` → `backend/.env` and set `CMS_*` so you can skip the connection form during development.
3. From monorepo root: `npm run demo:install` then `npm run demo:all`.
4. Open **http://localhost:5175** (API on **http://localhost:5050**).

Register webhooks in CMS using the **webhook_url** from **Resolved config** on the Consent tab (typically `http://localhost:5050/webhooks/securedapp` locally).
