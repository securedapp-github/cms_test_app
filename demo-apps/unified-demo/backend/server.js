require('dotenv').config();
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

const PORT = parseInt(process.env.PORT || '5050', 10);
const CMS_BASE_URL = (process.env.CMS_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
const CMS_PUBLIC_API_KEY = process.env.CMS_PUBLIC_API_KEY || '';
const CMS_APP_ID = process.env.CMS_APP_ID || '';
const CMS_ADMIN_BEARER_TOKEN = process.env.CMS_ADMIN_BEARER_TOKEN || '';
const ERP_WEBHOOK_PUBLIC_URL =
  process.env.ERP_WEBHOOK_PUBLIC_URL || `http://localhost:${PORT}/webhooks/securedapp`;
const ERP_WEBHOOK_SECRET = process.env.ERP_WEBHOOK_SECRET || '';
const DEFAULT_WEBHOOK_EVENTS = [
  'consent.granted',
  'consent.withdrawn',
  'policy.updated',
  'purpose.created',
  'dsr.completed',
];

const webhookEvents = [];
const MAX_WEBHOOK_EVENTS = 200;

function requirePublicApiConfig(options = {}) {
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
  requirePublicApiConfig({ needsAppId: Boolean(options.needsAppId) });
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

function parseSignatureHeader(header) {
  const out = { t: null, v1: null };
  if (!header) return out;
  const parts = String(header)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const p of parts) {
    const [k, v] = p.split('=');
    if (!k || v == null) continue;
    if (k === 't') out.t = v;
    if (k === 'v1') out.v1 = v;
  }
  return out;
}

function verifySignatureIfConfigured(rawBody, signatureHeader, timestampHeader) {
  if (!ERP_WEBHOOK_SECRET) return { ok: true, reason: 'no-secret-configured' };
  if (!signatureHeader) return { ok: false, reason: 'missing-signature' };
  const parsed = parseSignatureHeader(signatureHeader);
  const ts = parsed.t || (timestampHeader ? String(timestampHeader).trim() : null);
  if (!ts) return { ok: false, reason: 'missing-timestamp' };
  if (!parsed.v1) return { ok: false, reason: 'missing-v1' };
  const msg = `${ts}.${rawBody}`;
  const expected = crypto.createHmac('sha256', ERP_WEBHOOK_SECRET).update(msg, 'utf8').digest('hex');
  const provided = String(parsed.v1).trim();
  const ok =
    expected.length === provided.length &&
    crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(provided, 'utf8'));
  return { ok, reason: ok ? 'verified' : 'mismatch' };
}

async function cmsRegisterWebhook(url, secret, events) {
  if (!CMS_ADMIN_BEARER_TOKEN) {
    const err = new Error('CMS_ADMIN_BEARER_TOKEN is not set');
    err.statusCode = 500;
    throw err;
  }
  const res = await fetch(`${CMS_BASE_URL}/webhooks`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      authorization: `Bearer ${CMS_ADMIN_BEARER_TOKEN}`,
    },
    body: JSON.stringify({ url, secret, events }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error((data && data.error) || `CMS error ${res.status}`);
    err.statusCode = res.status;
    err.details = data;
    throw err;
  }
  return data;
}

const app = express();
app.use(cors({ origin: true, credentials: true }));

app.use(
  express.json({
    limit: '2mb',
    verify: (req, res, buf) => {
      req.rawBody = buf.toString('utf8');
    },
  })
);

/* --- Consent (public API proxy) --- */
app.get('/api/config', (req, res) => {
  res.json({
    cms_base_url: CMS_BASE_URL,
    app_id: CMS_APP_ID,
    has_api_key: Boolean(CMS_PUBLIC_API_KEY),
    webhook_url: ERP_WEBHOOK_PUBLIC_URL,
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

/* --- Redirect consent (API key on server) --- */
app.get('/api/redirect/prefill', async (req, res, next) => {
  try {
    const [purposesRes, policyRes] = await Promise.all([
      cmsFetch('/public/purposes'),
      cmsFetch(`/public/apps/${CMS_APP_ID}/policy`, { needsAppId: true }),
    ]);
    res.json({ purposes: purposesRes.purposes || [], policy: policyRes });
  } catch (e) {
    next(e);
  }
});

app.post('/api/redirect/request', async (req, res, next) => {
  try {
    const { email, phone_number, purpose_id, policy_version_id } = req.body || {};
    const data = await cmsFetch(`/public/apps/${CMS_APP_ID}/consent/redirect/request`, {
      needsAppId: true,
      method: 'POST',
      body: JSON.stringify({
        email,
        phone_number,
        purpose_id,
        policy_version_id,
      }),
    });
    res.json(data);
  } catch (e) {
    next(e);
  }
});

/* --- ERP / webhooks --- */
app.get('/api/health', (req, res) => {
  res.json({ ok: true, now: new Date().toISOString() });
});

app.get('/api/events', (req, res) => {
  res.json({ events: webhookEvents });
});

app.post('/api/events/clear', (req, res) => {
  webhookEvents.splice(0, webhookEvents.length);
  res.json({ cleared: true });
});

app.post('/api/webhooks/register', async (req, res, next) => {
  try {
    const url = req.body?.url || ERP_WEBHOOK_PUBLIC_URL;
    const secret = req.body?.secret || ERP_WEBHOOK_SECRET || undefined;
    const ev =
      Array.isArray(req.body?.events) && req.body.events.length > 0
        ? req.body.events
        : DEFAULT_WEBHOOK_EVENTS;
    const data = await cmsRegisterWebhook(url, secret, ev);
    res.status(201).json(data);
  } catch (e) {
    next(e);
  }
});

app.post('/webhooks/securedapp', (req, res) => {
  const sig = req.header('x-webhook-signature');
  const ts = req.header('x-webhook-timestamp');
  const verification = verifySignatureIfConfigured(
    req.rawBody || JSON.stringify(req.body || {}),
    sig,
    ts
  );
  const record = {
    id: crypto.randomUUID
      ? crypto.randomUUID()
      : String(Date.now()) + Math.random().toString(16).slice(2),
    received_at: new Date().toISOString(),
    signature: sig || null,
    verification: { ok: verification.ok, reason: verification.reason },
    headers: {
      'x-webhook-event': req.header('x-webhook-event') || null,
      'x-webhook-timestamp': ts || null,
    },
    body: req.body,
  };
  webhookEvents.unshift(record);
  if (webhookEvents.length > MAX_WEBHOOK_EVENTS) webhookEvents.length = MAX_WEBHOOK_EVENTS;
  res.status(200).json({ ok: true });
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
  console.log(`Unified CMS demo API: http://localhost:${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`Webhook receiver: ${ERP_WEBHOOK_PUBLIC_URL}`);
});
