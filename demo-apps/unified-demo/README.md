# Unified CMS demo (1 backend + 1 UI)

Combines:

- **Consent (embedded)** — grant/withdraw via CMS public API (credentials from the UI or optional `.env` fallbacks)
- **Redirect consent** — redirect URL + OTP popup

## Production-style deploy

Deploy the Node API and static UI **once**. Operators open the UI and fill **CMS connection** (saved in **localStorage** in that browser only):

- CMS base URL → `x-cms-base-url`
- Tenant public API key → `x-api-key`
- App UUID → `x-app-id`

The demo API forwards those headers to your CMS on each request. **Do not treat the browser as secret storage** — the API key is visible in DevTools; this pattern is for demos and internal tools.

**Server environment** can be minimal:

- `PORT` — listen port

You do **not** need `CMS_*` in production if every user configures the connection in the UI.

## Local dev

1. CMS API: `npm start` in monorepo root (e.g. `:3000`).
2. Optional: copy `backend/.env.example` → `backend/.env` and set `CMS_*` so you can skip the connection form during development.
3. From monorepo root: `npm run demo:install` then `npm run demo:all`.
4. Open **http://localhost:5175** (API on **http://localhost:5050**).

## Hosted / preview notes

- **Redirect tab** only enables “Initiate consent flow” when the app’s active policy reports `consent_flow: redirect`. The **Embedded** tab is the opposite. Use the tab that matches how the app is configured in CMS admin.
- **`npm run build && npm run preview`**: the Vite **preview** server proxies `/api` to `http://localhost:5050`, same as dev — run the demo backend on port **5050** (or change the proxy in `frontend/vite.config.js`).
- If the static UI is deployed without a same-origin `/api` proxy, set **`VITE_DEMO_API_BASE_URL`** (e.g. `https://your-demo-api.example.com`) when building the frontend so calls go to the demo Node API.
- **DSR / access flows** in the main CMS typically expect at least one **consent record** for that identity on the app. Complete redirect OTP consent (or embedded grant) first, then run DSR tests.

## Flipkart-style initiate body

`POST /public/apps/:appId/consent/initiate` accepts `email`, `phone_number` and/or **`mobile`** (same value is fine), optional **`dob`** (`YYYY-MM-DD`), optional **`policy_version_id`**, and **`purpose_ids`**. The unified demo sends both `phone_number` and `mobile` for compatibility with strict validators.
