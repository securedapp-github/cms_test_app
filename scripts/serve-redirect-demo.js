/**
 * Serve redirect-consent demo page on port 5501 (standalone HTML under demo-apps/).
 * Run: npm run test:redirect
 */
const path = require('path');
const express = require('express');

const app = express();
const PORT = 5501;
const ROOT = path.resolve(__dirname, '..');
const DEMO_APPS = path.join(ROOT, 'demo-apps');

app.use(express.static(DEMO_APPS, { index: false }));

app.get('/', (req, res) => {
  res.sendFile(path.join(DEMO_APPS, 'redirect-consent-demo.html'));
});

app.listen(PORT, () => {
  console.log(`Redirect consent demo: http://localhost:${PORT}`);
});
