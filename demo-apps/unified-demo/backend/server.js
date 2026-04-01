require('dotenv').config();
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

const PORT = parseInt(process.env.PORT || '5050', 10);
/** Optional env fallbacks for local dev; production can omit and use headers from the UI only */
const ENV_CMS_BASE_URL = (process.env.CMS_BASE_URL || '').replace(/\/+$/, '');
const ENV_CMS_PUBLIC_API_KEY = process.env.CMS_PUBLIC_API_KEY || '';
const ENV_CMS_APP_ID = process.env.CMS_APP_ID || '';
const DEFAULT_PUBLIC_DEMO_APP_URL = 'https://cms-test.securedapp.io';
/** Incoming webhook HMAC — only CMS → this server; cannot be set per-browser */
const ERP_WEBHOOK_SECRET = process.env.ERP_WEBHOOK_SECRET || '';

const webhookEvents = [];
const MAX_WEBHOOK_EVENTS = 200;
const sseClients = new Set();

function normalizeBaseUrl(raw) {
  const s = String(raw || '').trim().replace(/\/+$/, '');
  if (!s) return '';
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    return `${u.protocol}//${u.host}${u.pathname.replace(/\/+$/, '') || ''}`;
  } catch {
    return '';
  }
}

/**
 * Per-request CMS target + credentials from headers (production demo) or .env (dev fallback).
 * Headers: x-cms-base-url, x-api-key, x-app-id
 */
function getCmsContext(req) {
  const h = req.headers || {};
  const base =
    normalizeBaseUrl(h['x-cms-base-url'] || h['x-demo-cms-base-url']) || ENV_CMS_BASE_URL;
  const key = String(h['x-api-key'] || '').trim() || ENV_CMS_PUBLIC_API_KEY;
  const appId = String(h['x-app-id'] || h['x-demo-app-id'] || '').trim() || ENV_CMS_APP_ID;
  return { base, key, appId };
}

function requireClientConfig(ctx, options = {}) {
  const needsAppId = Boolean(options.needsAppId);
  const missing = [];
  if (!ctx.base) missing.push('x-cms-base-url (or CMS_BASE_URL in .env)');
  if (!ctx.key) missing.push('x-api-key (or CMS_PUBLIC_API_KEY in .env)');
  if (needsAppId && !ctx.appId) missing.push('x-app-id (or CMS_APP_ID in .env)');
  if (missing.length) {
    const err = new Error(`Missing CMS connection: ${missing.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }
}

async function cmsFetch(ctx, path, options = {}) {
  requireClientConfig(ctx, { needsAppId: Boolean(options.needsAppId) });
  const url = `${ctx.base}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-api-key': ctx.key,
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

async function getTenantConsentFlow(ctx) {
  const policy = await cmsFetch(ctx, `/public/apps/${ctx.appId}/policy`, { needsAppId: true });
  return String(policy?.policyVersion?.consent_flow || 'embedded').toLowerCase();
}

function publicDemoApiBase(req) {
  const explicit = (process.env.PUBLIC_DEMO_API_URL || '').trim().replace(/\/+$/, '');
  if (explicit) return explicit;
  const candidates = [
    req.get('origin'),
    req.get('referer'),
    req.get('x-forwarded-host') ? `${req.get('x-forwarded-proto') || 'https'}://${req.get('x-forwarded-host')}` : null,
    req.get('host') ? `${req.protocol || 'http'}://${req.get('host')}` : null,
  ].filter(Boolean);

  for (const candidate of candidates) {
    const normalized = normalizeBaseUrl(candidate);
    if (!normalized) continue;
    // Prefer hosted demo URL whenever request context is securedapp domain.
    if (normalized.includes('securedapp.io')) return DEFAULT_PUBLIC_DEMO_APP_URL;
    if (!normalized.includes('localhost') && !normalized.includes('127.0.0.1')) return normalized;
  }

  // If proxy headers are missing in hosted env, avoid leaking localhost URL to users.
  if (process.env.NODE_ENV === 'production') return DEFAULT_PUBLIC_DEMO_APP_URL;
  return `http://localhost:${PORT}`;
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
  const ctx = getCmsContext(req);
  const webhookBase = publicDemoApiBase(req);
  res.json({
    cms_base_url: ctx.base || null,
    app_id: ctx.appId || null,
    has_api_key: Boolean(ctx.key),
    // Prefer /api path since hosted reverse proxies commonly route /api/* to backend.
    webhook_url: `${webhookBase}/api/webhooks/securedapp`,
    source: ctx.base && ctx.key ? 'headers_or_env' : 'unset',
  });
});

app.get('/api/purposes', async (req, res, next) => {
  try {
    const data = await cmsFetch(getCmsContext(req), '/public/purposes');
    res.json(data);
  } catch (e) {
    next(e);
  }
});

app.get('/api/policy', async (req, res, next) => {
  try {
    const ctx = getCmsContext(req);
    const data = await cmsFetch(ctx, `/public/apps/${ctx.appId}/policy`, { needsAppId: true });
    res.json(data);
  } catch (e) {
    next(e);
  }
});

app.post('/api/consent/grant', async (req, res, next) => {
  try {
    const ctx = getCmsContext(req);
    const flow = await getTenantConsentFlow(ctx);
    if (flow !== 'embedded') {
      const err = new Error('This tenant uses redirect consent flow. Embedded consent is disabled.');
      err.statusCode = 409;
      throw err;
    }
    const { email, phone_number, purpose_id, purpose_ids, policy_version_id } = req.body || {};
    const data = await cmsFetch(ctx, `/public/apps/${ctx.appId}/consent`, {
      needsAppId: true,
      method: 'POST',
      body: JSON.stringify({ email, phone_number, purpose_id, purpose_ids, policy_version_id }),
    });
    res.status(201).json(data);
  } catch (e) {
    next(e);
  }
});

app.post('/api/consent/withdraw', async (req, res, next) => {
  try {
    const ctx = getCmsContext(req);
    const flow = await getTenantConsentFlow(ctx);
    if (flow !== 'embedded') {
      const err = new Error('This tenant uses redirect consent flow. Embedded consent is disabled.');
      err.statusCode = 409;
      throw err;
    }
    const { email, phone_number, purpose_id, purpose_ids } = req.body || {};
    const data = await cmsFetch(ctx, `/public/apps/${ctx.appId}/consent`, {
      needsAppId: true,
      method: 'DELETE',
      body: JSON.stringify({ email, phone_number, purpose_id, purpose_ids }),
    });
    res.json(data);
  } catch (e) {
    next(e);
  }
});

app.post('/api/consent/state', async (req, res, next) => {
  try {
    const ctx = getCmsContext(req);
    const { email, phone_number } = req.body || {};
    const data = await cmsFetch(ctx, `/public/apps/${ctx.appId}/consent/state`, {
      needsAppId: true,
      method: 'POST',
      body: JSON.stringify({ email, phone_number }),
    });
    res.json(data);
  } catch (e) {
    next(e);
  }
});

/* --- Redirect consent --- */
app.get('/api/redirect/prefill', async (req, res, next) => {
  try {
    const ctx = getCmsContext(req);
    const [purposesRes, policyRes] = await Promise.all([
      cmsFetch(ctx, '/public/purposes'),
      cmsFetch(ctx, `/public/apps/${ctx.appId}/policy`, { needsAppId: true }),
    ]);
    res.json({ purposes: purposesRes.purposes || [], policy: policyRes });
  } catch (e) {
    next(e);
  }
});

app.post('/api/redirect/request', async (req, res, next) => {
  try {
    const ctx = getCmsContext(req);
    const flow = await getTenantConsentFlow(ctx);
    if (flow !== 'redirect') {
      const err = new Error('This tenant uses embedded consent flow. Redirect consent is disabled.');
      err.statusCode = 409;
      throw err;
    }
    const { email, phone_number, purpose_id, purpose_ids, policy_version_id } = req.body || {};
    const data = await cmsFetch(ctx, `/public/apps/${ctx.appId}/consent/redirect/request`, {
      needsAppId: true,
      method: 'POST',
      body: JSON.stringify({
        email,
        phone_number,
        purpose_id,
        purpose_ids,
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

app.get('/health', (req, res) => {
  res.json({ ok: true, now: new Date().toISOString() });
});

app.get('/api/events', (req, res) => {
  res.json({ events: webhookEvents });
});

app.get('/api/events/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const client = { res };
  sseClients.add(client);
  res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);

  req.on('close', () => {
    sseClients.delete(client);
  });
});

app.post('/api/events/clear', (req, res) => {
  webhookEvents.splice(0, webhookEvents.length);
  res.json({ cleared: true });
});

function handleWebhookReceive(req, res) {
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
  const payload = `event: webhook\ndata: ${JSON.stringify(record)}\n\n`;
  for (const client of sseClients) {
    try {
      client.res.write(payload);
    } catch (_) {
      sseClients.delete(client);
    }
  }
  res.status(200).json({ ok: true });
}

// Support both direct and /api-prefixed webhook paths for hosted proxy compatibility.
app.post('/webhooks/securedapp', handleWebhookReceive);
app.post('/api/webhooks/securedapp', handleWebhookReceive);

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
  console.log('CMS connection: send x-cms-base-url, x-api-key, x-app-id from the UI (or set CMS_* in .env for dev).');
});
