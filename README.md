# CMS test apps

Integration demo for [SecureDApp CMS](https://github.com/securedapp-github/CMS_BE): **one Node backend** + **one Vite/React UI** under [`demo-apps/unified-demo/`](./demo-apps/unified-demo/).

## Ports (local defaults)

| Port | What |
|------|------|
| **3000** | **CMS API** (this repo does not run it — start CMS separately). |
| **5050** | **Unified demo API** — Express server that (1) proxies public consent/redirect calls to CMS with `x-api-key` on the server, (2) exposes `/webhooks/securedapp` for CMS webhooks. |
| **5175** | **Unified demo UI** — Vite dev server; browser calls only `/api` on 5050 (via proxy), so the API key never hits the browser for consent/redirect. |

Optional legacy static page: [`demo-apps/redirect-consent-demo.html`](./demo-apps/redirect-consent-demo.html) (browser must send `x-api-key` — prefer the unified UI for testing).

---

## Setup

### 1. Run the CMS backend

From your CMS repo (e.g. `CMS_BE` / monorepo), with DB/Redis configured:

```bash
npm install
npm start
```

Confirm API is up (often `http://localhost:3000`).

### 2. Configure the unified demo API

```bash
cd demo-apps/unified-demo/backend
copy .env.example .env
```

Edit **`.env`**:

- **`CMS_BASE_URL`** — CMS origin, e.g. `http://localhost:3000`
- **`CMS_PUBLIC_API_KEY`** — tenant public API key from CMS
- **`CMS_APP_ID`** — app UUID to test
- Optional: **`CMS_ADMIN_BEARER_TOKEN`** (tenant JWT) for “register webhook” in the UI
- Optional: **`ERP_WEBHOOK_SECRET`** — must match secret configured on the webhook in CMS
- **`ERP_WEBHOOK_PUBLIC_URL`** — default `http://localhost:5050/webhooks/securedapp` (use this URL when registering the webhook in CMS)

### 3. Install dependencies

**From this repository root** (`cms_test_app`):

```bash
npm install
npm run demo:install
```

(`demo:install` runs `npm install` in `unified-demo/backend` and `unified-demo/frontend`.)

### 4. Run the unified demo

**Option A — one command (recommended)**

```bash
npm run demo:all
```

**Option B — two terminals**

```bash
# Terminal 1
npm run demo:backend

# Terminal 2
npm run demo:frontend
```

Open **http://localhost:5175**. Use the three tabs: **Consent**, **Webhooks**, **Redirect consent**.

---

## Test checklist

1. **Consent** — Purposes/policy load; grant and withdraw with email, phone, purpose.
2. **Webhooks** — In CMS, register webhook URL `http://localhost:5050/webhooks/securedapp`. Trigger events (e.g. consent); events should appear in the UI.
3. **Redirect consent** — Prefill → fill email/phone → open OTP popup (allow popups for `http://localhost:5175`). CMS CORS must allow origin `http://localhost:5175`.

---

## Repository layout

```
demo-apps/
  unified-demo/
    backend/    # Express on :5050
    frontend/   # Vite on :5175
  redirect-consent-demo.html   # optional static legacy
  README.md
```

Mirrors the **`demo-apps/unified-demo/`** tree from the main CMS monorepo where applicable.
