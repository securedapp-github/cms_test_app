# CMS test apps

Integration test UIs for [SecureDApp CMS](https://github.com/securedapp-github/CMS_BE). Each app splits **backend** (Node proxy / webhook receiver) and **frontend** (Vite + React) into separate folders.

## Layout

| App | Backend | Frontend |
|-----|---------|----------|
| **Consent Demo** | `consent-demo/backend` — proxies public CMS API (`x-api-key` stays on server) | `consent-demo/frontend` |
| **ERP Simulator** | `erp-sim/backend` — webhook receiver + optional CMS webhook registration | `erp-sim/frontend` |

---

## Consent Demo

Tests: `GET /public/purposes`, `GET /public/apps/:appId/policy`, `POST/DELETE /public/apps/:appId/consent`.

1. **Backend env** — copy `consent-demo/backend/.env.example` → `consent-demo/backend/.env`  
   - `CMS_BASE_URL`, `CMS_PUBLIC_API_KEY`, `CMS_APP_ID`

2. **Run** (two terminals)

```bash
cd consent-demo/backend
npm install
npm run dev
```

```bash
cd consent-demo/frontend
npm install
npm run dev
```

Open the Vite URL (default `http://localhost:5173`). API proxy: `/api` → `http://localhost:4100`.

---

## ERP Simulator

Webhook receiver URL (default): `http://localhost:4200/webhooks/securedapp`

1. **Backend env** — copy `erp-sim/backend/.env.example` → `erp-sim/backend/.env`  
   - Optional: `CMS_ADMIN_BEARER_TOKEN` to register webhooks from the UI  
   - `ERP_WEBHOOK_SECRET` for signature verification

2. **Run** (two terminals)

```bash
cd erp-sim/backend
npm install
npm run dev
```

```bash
cd erp-sim/frontend
npm install
npm run dev
```

Open the Vite URL (default `http://localhost:5174`). API proxy: `/api` → `http://localhost:4200`.

---

## Repository

Pushed from the `demo-apps` folder of the main CMS monorepo, reorganized with **backend** and **frontend** in separate directories per app.
