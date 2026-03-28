# `demo-apps` — integration demos

Everything in this repository lives under **`demo-apps/`** so it matches the CMS monorepo layout.

| Piece | Path |
|--------|------|
| **Consent demo** (public API + Vite UI) | `consent-demo/` |
| **ERP simulator** (webhooks + Vite UI) | `erp-sim/` |
| **Redirect consent** (static HTML + popup OTP flow) | `redirect-consent-demo.html` |

See the **root [`README.md`](../README.md)** for how to run each app. In the main **securedapp_cms** repo you can also run all three from one launcher (`npm run demo:all` → `demo-hub/` on port **5600**).
