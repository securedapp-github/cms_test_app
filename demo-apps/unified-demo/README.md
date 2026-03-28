# Unified CMS demo (1 backend + 1 UI)

Combines:

- **Consent (embedded)** — public grant/withdraw via server-held `x-api-key`
- **Webhooks (ERP)** — receive CMS webhooks + optional register-from-UI
- **Redirect consent** — create redirect URL + OTP popup (also via server-held key)

## Run

1. Start the **CMS API** (e.g. `http://localhost:3000`) from your CMS repo.
2. Copy `backend/.env.example` → `backend/.env` and set `CMS_PUBLIC_API_KEY`, `CMS_APP_ID`, and optionally `CMS_ADMIN_BEARER_TOKEN`, `ERP_WEBHOOK_SECRET`.
3. From **`cms_test_app` repo root**: `npm install` → `npm run demo:install` → `npm run demo:all`.  
   (In the CMS monorepo instead: `npm run demo:install` and `npm run demo:all` from monorepo root.)
4. Open **http://localhost:5175** (demo API **http://localhost:5050**).

Register webhooks in CMS with `http://localhost:5050/webhooks/securedapp` (or override `ERP_WEBHOOK_PUBLIC_URL`).
