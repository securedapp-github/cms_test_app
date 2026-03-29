## Demo apps (this repo)

### Unified demo (recommended)

Single Node proxy API plus React UI — embedded consent, webhooks (ERP), and redirect consent:

- **`unified-demo/backend/`** — demo API (default **:5050**)
- **`unified-demo/frontend/`** — Vite UI (default **:5175**)

From the **monorepo root**:

```bash
npm run demo:install
npm run demo:all
```

Then open **http://localhost:5175**. Start the main CMS API separately (e.g. **:3000**) and configure connection fields in the UI.

Details: [`unified-demo/README.md`](./unified-demo/README.md).

### Standalone redirect HTML

- **`redirect-consent-demo.html`** — static page for redirect + OTP flow testing.
- Serve with **`npm run test:redirect`** (port **5501**) while the CMS API runs on **:3000**.
