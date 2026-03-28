# CMS test apps

Integration test UIs for [SecureDApp CMS](https://github.com/securedapp-github/CMS_BE). Sources are under **`demo-apps/`** (same layout as the CMS monorepo). Each app splits **backend** (Node proxy / webhook receiver) and **frontend** (Vite + React) into separate folders.

## Layout

| App | Backend | Frontend |
|-----|---------|----------|
| **Consent Demo** | `demo-apps/consent-demo/backend` — proxies public CMS API (`x-api-key` stays on server) | `demo-apps/consent-demo/frontend` |
| **ERP Simulator** | `demo-apps/erp-sim/backend` — webhook receiver + optional CMS webhook registration | `demo-apps/erp-sim/frontend` |
| **Redirect Consent** | — (static page; calls CMS with `x-api-key` from the browser) | `demo-apps/redirect-consent-demo.html` |

---

## Consent Demo

Tests: `GET /public/purposes`, `GET /public/apps/:appId/policy`, `POST/DELETE /public/apps/:appId/consent`.

1. **Backend env** — copy `demo-apps/consent-demo/backend/.env.example` → `demo-apps/consent-demo/backend/.env`  
   - `CMS_BASE_URL`, `CMS_PUBLIC_API_KEY`, `CMS_APP_ID`

2. **Run** (two terminals)

```bash
cd demo-apps/consent-demo/backend
npm install
npm run dev
```

```bash
cd demo-apps/consent-demo/frontend
npm install
npm run dev
```

Open the Vite URL (default `http://localhost:5173`). API proxy: `/api` → `http://localhost:4100`.

---

## ERP Simulator

Webhook receiver URL (default): `http://localhost:4200/webhooks/securedapp`

1. **Backend env** — copy `demo-apps/erp-sim/backend/.env.example` → `demo-apps/erp-sim/backend/.env`  
   - Optional: `CMS_ADMIN_BEARER_TOKEN` to register webhooks from the UI  
   - `ERP_WEBHOOK_SECRET` for signature verification

2. **Run** (two terminals)

```bash
cd demo-apps/erp-sim/backend
npm install
npm run dev
```

```bash
cd demo-apps/erp-sim/frontend
npm install
npm run dev
```

Open the Vite URL (default `http://localhost:5174`). API proxy: `/api` → `http://localhost:4200`.

---

## Redirect Consent Demo

Static page that creates a redirect consent request and opens the hosted OTP flow in a popup.

1. **API** — start the CMS API (e.g. `http://localhost:3000`) with CORS allowing your demo origin.
2. **Serve the `demo-apps` folder** on `http://localhost:5501` (must match API CORS), for example:

```bash
cd demo-apps
npx serve -l 5501
```

3. Open the served URL and open `redirect-consent-demo.html`.

**In the page:** set API URL, `x-api-key`, `app_id`, purpose/policy (or use **Prefill**), email and phone → **Create Redirect URL + Open Popup** → **Send OTP** → verify → consent granted.

---

## Repository

Mirrors the **`demo-apps/`** tree from the CMS monorepo, with **backend** and **frontend** in separate directories per app.
