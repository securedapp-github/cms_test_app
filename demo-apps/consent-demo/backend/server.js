require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

const PORT = parseInt(process.env.PORT || '4100', 10);
const CMS_BASE_URL = (process.env.CMS_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
const CMS_PUBLIC_API_KEY = process.env.CMS_PUBLIC_API_KEY || '';
const CMS_APP_ID = process.env.CMS_APP_ID || '';

function requireConfig(options = {}) {
  const needsAppId = Boolean(options.needsAppId);
  if (!CMS_PUBLIC_API_KEY) {
    const err = new Error('CMS_PUBLIC_API_KEY is not set');
    err.statusCode = 500;
    throw err;
  }
  if (needsAppId && !CMS_APP_ID) {
    const err = new Error('CMS_APP_ID is not set');
    err.statusCode = 500;
    throw err;
  }
}

async function cmsFetch(path, options = {}) {
  requireConfig({ needsAppId: Boolean(options.needsAppId) });
  const url = `${CMS_BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-api-key': CMS_PUBLIC_API_KEY,
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(json && json.error ? json.error : `CMS error ${res.status}`);
    err.statusCode = res.status;
    err.details = json;
    throw err;
  }
  return json;
}

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/config', (req, res) => {
  res.json({
    cms_base_url: CMS_BASE_URL,
    app_id: CMS_APP_ID,
    has_api_key: Boolean(CMS_PUBLIC_API_KEY),
  });
});

app.get('/api/purposes', async (req, res, next) => {
  try {
    const data = await cmsFetch('/public/purposes');
    res.json(data);
  } catch (e) {
    next(e);
  }
});

app.get('/api/policy', async (req, res, next) => {
  try {
    const data = await cmsFetch(`/public/apps/${CMS_APP_ID}/policy`, { needsAppId: true });
    res.json(data);
  } catch (e) {
    next(e);
  }
});

app.post('/api/consent/grant', async (req, res, next) => {
  try {
    const { email, phone_number, purpose_id, policy_version_id } = req.body || {};
    const data = await cmsFetch(`/public/apps/${CMS_APP_ID}/consent`, {
      needsAppId: true,
      method: 'POST',
      body: JSON.stringify({ email, phone_number, purpose_id, policy_version_id }),
    });
    res.status(201).json(data);
  } catch (e) {
    next(e);
  }
});

app.post('/api/consent/withdraw', async (req, res, next) => {
  try {
    const { email, phone_number, purpose_id } = req.body || {};
    const data = await cmsFetch(`/public/apps/${CMS_APP_ID}/consent`, {
      needsAppId: true,
      method: 'DELETE',
      body: JSON.stringify({ email, phone_number, purpose_id }),
    });
    res.json(data);
  } catch (e) {
    next(e);
  }
});

app.use((err, req, res, next) => {
  const status = err.statusCode || 500;
  res.status(status).json({
    error: err.message || 'Server error',
    details: err.details || null,
  });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Consent demo API listening on http://localhost:${PORT}`);
});

