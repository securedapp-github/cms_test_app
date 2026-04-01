import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const LS_KEY = 'securedapp-unified-demo-connection-v1'

const pageWrap = {
  maxWidth: 1080,
  margin: '0 auto',
  padding: '28px 20px 40px',
  fontFamily:
    "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, Noto Sans, sans-serif",
  color: '#0f172a',
}
const card = {
  padding: 18,
  border: '1px solid #dbe3ef',
  borderRadius: 12,
  background: '#ffffff',
  marginBottom: 16,
  boxShadow: '0 1px 2px rgba(2, 6, 23, 0.05)',
}
const input = {
  width: '100%',
  padding: '10px 12px',
  marginTop: 6,
  borderRadius: 10,
  border: '1px solid #cbd5e1',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
}
const btn = {
  padding: '10px 16px',
  borderRadius: 10,
  border: 'none',
  cursor: 'pointer',
  fontWeight: 600,
  background: '#4f46e5',
  color: '#fff',
  minHeight: 40,
  boxShadow: '0 1px 2px rgba(79, 70, 229, 0.25)',
}
const btnSec = { ...btn, background: '#0f766e' }
const btnMuted = { ...btn, background: '#334155', boxShadow: '0 1px 2px rgba(51, 65, 85, 0.25)' }
const grid2 = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }
const muted = { color: '#64748b' }
const sectionTitle = { marginTop: 0, marginBottom: 10, fontSize: 18, fontWeight: 700 }

const defaultConn = {
  cmsBaseUrl: '',
  apiKey: '',
  appId: '',
}

const DemoConnContext = createContext(null)

function loadConn() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return { ...defaultConn }
    const p = JSON.parse(raw)
    return {
      cmsBaseUrl: typeof p.cmsBaseUrl === 'string' ? p.cmsBaseUrl : '',
      apiKey: typeof p.apiKey === 'string' ? p.apiKey : '',
      appId: typeof p.appId === 'string' ? p.appId : '',
    }
  } catch {
    return { ...defaultConn }
  }
}

function headersFromConn(conn) {
  const h = { 'content-type': 'application/json' }
  const u = conn.cmsBaseUrl.trim()
  const k = conn.apiKey.trim()
  const a = conn.appId.trim()
  if (u) h['x-cms-base-url'] = u
  if (k) h['x-api-key'] = k
  if (a) h['x-app-id'] = a
  return h
}

async function api(path, options, conn) {
  const base = headersFromConn(conn)
  try {
    const res = await fetch(path, {
      ...options,
      headers: { ...base, ...(options?.headers || {}) },
    })
    const data = await res.json().catch(() => null)
    if (res.ok) return data

    // If demo proxy is unavailable in deployment, fallback to direct CMS public APIs.
    if ([502, 503, 504].includes(res.status)) {
      const fallback = await cmsFallback(path, options, conn)
      if (fallback !== null) return fallback
    }
    throw new Error((data && data.error) || `Request failed: ${res.status}`)
  } catch (err) {
    // Network-level failure on demo proxy: try direct CMS fallback.
    const fallback = await cmsFallback(path, options, conn)
    if (fallback !== null) return fallback
    throw err
  }
}

async function cmsFallback(path, options, conn) {
  const baseUrl = String(conn?.cmsBaseUrl || '').trim().replace(/\/+$/, '')
  const appId = String(conn?.appId || '').trim()
  const apiKey = String(conn?.apiKey || '').trim()
  if (!baseUrl || !apiKey) return null

  async function directFetch(urlPath, method = 'GET', bodyObj = null, needsApp = false) {
    if (needsApp && !appId) throw new Error('App ID is required')
    const url = `${baseUrl}${urlPath}`
    const res = await fetch(url, {
      method,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-api-key': apiKey,
      },
      body: bodyObj ? JSON.stringify(bodyObj) : undefined,
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) throw new Error((data && data.error) || `CMS request failed: ${res.status}`)
    return data
  }

  const body = (() => {
    try {
      return options?.body ? JSON.parse(options.body) : {}
    } catch {
      return {}
    }
  })()

  switch (path) {
    case '/api/purposes':
      return directFetch('/public/purposes')
    case '/api/policy':
      return directFetch(`/public/apps/${appId}/policy`, 'GET', null, true)
    case '/api/consent/grant':
      return directFetch(`/public/apps/${appId}/consent`, 'POST', body, true)
    case '/api/consent/withdraw':
      return directFetch(`/public/apps/${appId}/consent`, 'DELETE', body, true)
    case '/api/consent/state':
      return directFetch(`/public/apps/${appId}/consent/state`, 'POST', body, true)
    case '/api/redirect/request':
      return directFetch(`/public/apps/${appId}/consent/redirect/request`, 'POST', body, true)
    case '/api/redirect/prefill': {
      const [purposes, policy] = await Promise.all([
        directFetch('/public/purposes'),
        directFetch(`/public/apps/${appId}/policy`, 'GET', null, true),
      ])
      return { purposes: purposes.purposes || [], policy }
    }
    default:
      return null
  }
}

function TabButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '10px 18px',
        borderRadius: 8,
        border: active ? '2px solid #4f46e5' : '1px solid #cbd5e1',
        background: active ? '#eef2ff' : '#fff',
        cursor: 'pointer',
        fontWeight: 600,
        color: active ? '#3730a3' : '#334155',
      }}
    >
      {children}
    </button>
  )
}

function ConnectionPanel() {
  const { conn, saveConn, connVersion } = useContext(DemoConnContext)
  const [draft, setDraft] = useState(conn)

  useEffect(() => {
    setDraft(conn)
  }, [connVersion, conn])

  function update(field, value) {
    setDraft((d) => ({ ...d, [field]: value }))
  }

  return (
    <div style={{ ...card, background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)', borderColor: '#cbd5e1' }}>
      <h2 style={{ ...sectionTitle, marginBottom: 6 }}>CMS connection</h2>
      <p style={{ marginTop: 0, ...muted, fontSize: 14, lineHeight: 1.5 }}>
        Enter your CMS details here once — saved in <strong>this browser only</strong> (localStorage). No redeploy needed.
        The demo API forwards <code>x-api-key</code> to your CMS; treat this like a dev tool, not a vault.
      </p>
      <p style={{ marginTop: -4, color: '#475569', fontSize: 13 }}>
        Recommended test backend: <strong>https://cms-test-be.securedapp.io</strong>. Production backend
        <strong> https://cmsbe.securedapp.io</strong> is also supported.
      </p>
      <div style={grid2}>
        <label style={{ gridColumn: '1 / -1' }}>
          CMS base URL
          <input
            value={draft.cmsBaseUrl}
            onChange={(e) => update('cmsBaseUrl', e.target.value)}
            style={input}
            placeholder="https://cms-test-be.securedapp.io"
            autoComplete="off"
          />
        </label>
        <label>
          x-api-key (tenant public API key)
          <input
            value={draft.apiKey}
            onChange={(e) => update('apiKey', e.target.value)}
            style={input}
            type="password"
            placeholder="Required for consent / redirect"
            autoComplete="off"
          />
        </label>
        <label>
          App ID (UUID)
          <input
            value={draft.appId}
            onChange={(e) => update('appId', e.target.value)}
            style={input}
            placeholder="Required for app-scoped calls"
            autoComplete="off"
          />
        </label>
      </div>
      <button type="button" style={{ ...btn, marginTop: 14 }} onClick={() => saveConn(draft)}>
        Save connection
      </button>
    </div>
  )
}

function ConsentSection() {
  const { conn, connVersion } = useContext(DemoConnContext)
  const [purposes, setPurposes] = useState([])
  const [policy, setPolicy] = useState(null)
  const [email, setEmail] = useState('user@example.com')
  const [phoneNumber, setPhoneNumber] = useState('9876543210')
  const [selectedPurposeIds, setSelectedPurposeIds] = useState([])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const policyVersionId = useMemo(() => policy?.policyVersion?.id || null, [policy])
  const consentFlow = useMemo(() => policy?.policyVersion?.consent_flow || 'embedded', [policy])
  const embeddedAllowed = consentFlow === 'embedded'

  useEffect(() => {
    setError(null)
    setPurposes([])
    setPolicy(null)
    setSelectedPurposeIds([])
    ;(async () => {
      try {
        const p = await api('/api/purposes', {}, conn)
        setPurposes(p.purposes || [])
        const pol = await api('/api/policy', {}, conn)
        setPolicy(pol || null)
      } catch (e) {
        setError(e.message)
      }
    })()
  }, [connVersion, conn])

  async function onGrant() {
    setError(null)
    setResult(null)
    setLoading(true)
    try {
      const data = await api(
        '/api/consent/grant',
        {
          method: 'POST',
          body: JSON.stringify({
            email,
            phone_number: phoneNumber,
            purpose_ids: selectedPurposeIds,
            policy_version_id: policyVersionId,
          }),
        },
        conn
      )
      setResult(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function onWithdraw() {
    setError(null)
    setResult(null)
    setLoading(true)
    try {
      const data = await api(
        '/api/consent/withdraw',
        {
          method: 'POST',
          body: JSON.stringify({
            email,
            phone_number: phoneNumber,
            purpose_ids: selectedPurposeIds,
          }),
        },
        conn
      )
      setResult(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function onFetchState() {
    setError(null)
    setResult(null)
    setLoading(true)
    try {
      const data = await api(
        '/api/consent/state',
        {
          method: 'POST',
          body: JSON.stringify({
            email,
            phone_number: phoneNumber,
          }),
        },
        conn
      )
      setResult(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function togglePurpose(purposeId) {
    setSelectedPurposeIds((prev) =>
      prev.includes(purposeId) ? prev.filter((id) => id !== purposeId) : [...prev, purposeId]
    )
  }

  function toggleAllPurposes() {
    setSelectedPurposeIds((prev) => (prev.length === purposes.length ? [] : purposes.map((p) => p.id)))
  }

  return (
    <div>
      <p style={{ ...muted, marginTop: 0 }}>
        Choose one or more purposes and submit consent. The latest active policy is used automatically.
      </p>
      {!embeddedAllowed ? (
        <p style={{ color: '#b45309', marginTop: 0 }}>
          This tenant is configured for <strong>redirect</strong> consent flow. Embedded grant/withdraw is blocked.
        </p>
      ) : null}
      <div style={card}>
        <h3 style={sectionTitle}>Grant / withdraw</h3>
        <p style={{ marginTop: 0, color: '#475569' }}>
          Active policy: <strong>{policy?.policyVersion?.version || 'Not available'}</strong>
        </p>
        <div style={grid2}>
          <label>
            Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} style={input} />
          </label>
          <label>
            Phone
            <input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} style={input} />
          </label>
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ marginBottom: 8, fontWeight: 600 }}>Purposes</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <input
                type="checkbox"
                checked={purposes.length > 0 && selectedPurposeIds.length === purposes.length}
                onChange={toggleAllPurposes}
              />
              <span>Select all purposes</span>
            </label>
            <div style={{ display: 'grid', gap: 8 }}>
              {purposes.map((p) => {
                const checked = selectedPurposeIds.includes(p.id)
                const dataPoints = Array.isArray(p.required_data) ? p.required_data : []
                return (
                  <div key={p.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, background: '#fcfdff' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                      <input type="checkbox" checked={checked} onChange={() => togglePurpose(p.id)} />
                      <span>{p.name}</span>
                    </label>
                    {dataPoints.length > 0 ? (
                      <div style={{ marginTop: 8, paddingLeft: 24, display: 'grid', gap: 4 }}>
                        {dataPoints.map((dp) => (
                          <label key={`${p.id}-${dp}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input type="checkbox" checked={checked} readOnly />
                            <span style={{ color: '#475569' }}>{dp}</span>
                          </label>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" disabled={loading} onClick={onFetchState} style={btnMuted}>
            {loading ? '…' : 'Fetch user consents'}
          </button>
          <button
            type="button"
            disabled={loading || selectedPurposeIds.length === 0 || !policyVersionId || !embeddedAllowed}
            onClick={onGrant}
            style={btn}
          >
            {loading ? '…' : 'Grant consent'}
          </button>
          <button
            type="button"
            disabled={loading || selectedPurposeIds.length === 0 || !embeddedAllowed}
            onClick={onWithdraw}
            style={btnSec}
          >
            {loading ? '…' : 'Withdraw'}
          </button>
        </div>
        {error ? <p style={{ color: '#b91c1c', marginTop: 12 }}>{error}</p> : null}
        {result?.error ? <p style={{ color: '#b91c1c', marginTop: 12 }}>{result.error}</p> : null}
        {result && !result.error ? <p style={{ color: '#166534', marginTop: 12 }}>Request completed successfully.</p> : null}
      </div>
    </div>
  )
}

function ErpSection() {
  const { conn, connVersion } = useContext(DemoConnContext)
  const [events, setEvents] = useState([])
  const [error, setError] = useState(null)
  const [webhookUrl, setWebhookUrl] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const data = await api('/api/events', {}, conn)
      setEvents(data.events || [])
    } catch (e) {
      setError(e.message)
    }
  }, [conn])

  useEffect(() => {
    ;(async () => {
      try {
        const cfg = await api('/api/config', {}, conn)
        setWebhookUrl(cfg.webhook_url || '')
      } catch (_) {
        setWebhookUrl('')
      }
    })()
    refresh()
    const t = setInterval(refresh, 5000)
    return () => clearInterval(t)
  }, [connVersion, refresh])

  useEffect(() => {
    const stream = new EventSource('/api/events/stream')
    stream.addEventListener('webhook', (ev) => {
      try {
        const item = JSON.parse(ev.data)
        setEvents((prev) => {
          const next = [item, ...prev.filter((e) => e.id !== item.id)]
          return next.slice(0, 200)
        })
      } catch (_) {}
    })
    stream.onerror = () => {
      // Keep quiet; polling fallback continues.
    }
    return () => stream.close()
  }, [])

  async function onClear() {
    setBusy(true)
    setError(null)
    try {
      await api('/api/events/clear', { method: 'POST', body: JSON.stringify({}) }, conn)
      await refresh()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <p style={{ ...muted, marginTop: 0 }}>
        This tab shows webhook calls received by this demo in real time.
      </p>
      <div style={card}>
        <h3 style={sectionTitle}>Webhook endpoint</h3>
        <p style={{ color: '#475569', marginTop: 0 }}>Use this URL while creating webhook in CMS:</p>
        <div style={{ fontFamily: 'monospace', fontSize: 13, background: '#f8fafc', border: '1px solid #e2e8f0', padding: 12, borderRadius: 10 }}>
          {webhookUrl || 'Save connection first'}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" onClick={refresh} disabled={busy} style={btnSec}>
          Refresh
        </button>
        <button type="button" onClick={onClear} disabled={busy} style={btn}>
          Clear
        </button>
        <span style={{ color: '#64748b' }}>Events: {events.length}</span>
      </div>
      {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}
      <div style={{ marginTop: 16 }}>
        {events.map((e) => (
          <div key={e.id} style={{ ...card, marginBottom: 10, background: '#fbfdff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <strong>{e.headers?.['x-webhook-event'] || 'event'}</strong>
                <div style={{ color: '#64748b', fontSize: 14 }}>{e.received_at}</div>
              </div>
              <div style={{ textAlign: 'right', fontSize: 14 }}>
                <div>signature: {e.signature ? 'yes' : 'no'}</div>
                <div>
                  verify: {e.verification?.ok ? 'ok' : 'fail'} ({e.verification?.reason})
                </div>
              </div>
            </div>
            <pre style={{ marginTop: 10, whiteSpace: 'pre-wrap', fontSize: 12, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 10 }}>
              {JSON.stringify(e.body, null, 2)}
            </pre>
          </div>
        ))}
      </div>
    </div>
  )
}

function RedirectSection() {
  const { conn, connVersion } = useContext(DemoConnContext)
  const [purposes, setPurposes] = useState([])
  const [selectedPurposeIds, setSelectedPurposeIds] = useState([])
  const [policyVersionId, setPolicyVersionId] = useState('')
  const [email, setEmail] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [consentFlow, setConsentFlow] = useState('embedded')

  useEffect(() => {
    setResult(null)
    setPurposes([])
    setSelectedPurposeIds([])
    ;(async () => {
      setBusy(true)
      try {
        const data = await api('/api/redirect/prefill', {}, conn)
        const fetchedPurposes = data.purposes || []
        setPurposes(fetchedPurposes)
        if (data.policy?.policyVersion?.id) setPolicyVersionId(data.policy.policyVersion.id)
        setConsentFlow(data.policy?.policyVersion?.consent_flow || 'embedded')
      } catch (e) {
        setResult({ error: e.message })
      } finally {
        setBusy(false)
      }
    })()
  }, [connVersion, conn])

  async function onCreate() {
    setBusy(true)
    setResult(null)
    try {
      const data = await api(
        '/api/redirect/request',
        {
          method: 'POST',
          body: JSON.stringify({
            email: email.trim(),
            phone_number: phoneNumber.trim(),
            purpose_ids: selectedPurposeIds,
            policy_version_id: policyVersionId.trim(),
          }),
        },
        conn
      )
      setResult(data)
      if (!data.redirect_url) throw new Error('redirect_url missing')
      const popup = window.open(
        data.redirect_url,
        'redirect-consent-popup',
        'popup=yes,width=520,height=760,resizable=yes,scrollbars=yes'
      )
      if (!popup) {
        setResult({ ...data, note: 'Popup blocked — open redirect_url manually.' })
      }
    } catch (e) {
      setResult({ error: e.message })
    } finally {
      setBusy(false)
    }
  }

  function togglePurpose(purposeId) {
    setSelectedPurposeIds((prev) =>
      prev.includes(purposeId) ? prev.filter((id) => id !== purposeId) : [...prev, purposeId]
    )
  }

  function toggleAllPurposes() {
    setSelectedPurposeIds((prev) => (prev.length === purposes.length ? [] : purposes.map((p) => p.id)))
  }

  return (
    <div>
      <p style={{ ...muted, marginTop: 0 }}>
        We use the latest active policy automatically. Select purpose(s), enter user details, and open the OTP consent popup.
      </p>
      {consentFlow !== 'redirect' ? (
        <p style={{ color: '#b45309', marginTop: 0 }}>
          This tenant is configured for <strong>embedded</strong> consent flow. Redirect request is blocked.
        </p>
      ) : null}
      <div style={card}>
        <div style={grid2}>
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ marginBottom: 8, fontWeight: 600 }}>Purposes</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <input
                type="checkbox"
                checked={purposes.length > 0 && selectedPurposeIds.length === purposes.length}
                onChange={toggleAllPurposes}
              />
              <span>Select all purposes</span>
            </label>
            <div style={{ display: 'grid', gap: 8 }}>
              {purposes.map((p) => {
                const checked = selectedPurposeIds.includes(p.id)
                const dataPoints = Array.isArray(p.required_data) ? p.required_data : []
                return (
                  <div key={p.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, background: '#fcfdff' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                      <input type="checkbox" checked={checked} onChange={() => togglePurpose(p.id)} />
                      <span>{p.name}</span>
                    </label>
                    {dataPoints.length > 0 ? (
                      <div style={{ marginTop: 8, paddingLeft: 24, display: 'grid', gap: 4 }}>
                        {dataPoints.map((dp) => (
                          <label key={`${p.id}-${dp}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input type="checkbox" checked={checked} readOnly />
                            <span style={{ color: '#475569' }}>{dp}</span>
                          </label>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', color: '#475569', fontSize: 14 }}>
            Active policy: <strong style={{ marginLeft: 6 }}>{policyVersionId ? 'Auto-selected' : 'Not available'}</strong>
          </div>
          <label>
            email
            <input value={email} onChange={(e) => setEmail(e.target.value)} style={input} type="email" />
          </label>
          <label>
            phone_number
            <input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} style={input} />
          </label>
        </div>
        <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            style={btn}
            disabled={busy || selectedPurposeIds.length === 0 || !policyVersionId.trim() || consentFlow !== 'redirect'}
            onClick={onCreate}
          >
            Create redirect + open popup
          </button>
        </div>
      </div>
      <div style={card}>
        <strong style={{ fontSize: 15 }}>Status</strong>
        <p style={{ marginTop: 8, color: result?.error ? '#b91c1c' : '#166534' }}>
          {result ? (result.error || 'Redirect request created successfully.') : '—'}
        </p>
      </div>
    </div>
  )
}

export default function App() {
  const [tab, setTab] = useState('consent')
  const [conn, setConn] = useState(() => loadConn())
  const [connVersion, setConnVersion] = useState(0)

  const saveConn = useCallback((next) => {
    const merged = {
      cmsBaseUrl: next.cmsBaseUrl || '',
      apiKey: next.apiKey || '',
      appId: next.appId || '',
    }
    localStorage.setItem(LS_KEY, JSON.stringify(merged))
    setConn(merged)
    setConnVersion((v) => v + 1)
  }, [])

  const ctx = useMemo(
    () => ({ conn, setConn, saveConn, connVersion }),
    [conn, saveConn, connVersion]
  )

  return (
    <DemoConnContext.Provider value={ctx}>
      <div style={pageWrap}>
        <h1 style={{ margin: '0 0 8px', fontSize: 30, letterSpacing: '-0.01em' }}>Unified CMS demo</h1>
        <p style={{ margin: '0 0 20px', ...muted, lineHeight: 1.5 }}>
          Production-friendly: configure CMS URL, API key, and app ID in the browser — no server env churn. Deploy the
          static UI + small API once.
        </p>
        <ConnectionPanel />
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          <TabButton active={tab === 'consent'} onClick={() => setTab('consent')}>
            Consent (embedded)
          </TabButton>
          <TabButton active={tab === 'erp'} onClick={() => setTab('erp')}>
            Webhooks (ERP)
          </TabButton>
          <TabButton active={tab === 'redirect'} onClick={() => setTab('redirect')}>
            Redirect consent
          </TabButton>
        </div>
        {tab === 'consent' ? <ConsentSection /> : null}
        {tab === 'erp' ? <ErpSection /> : null}
        {tab === 'redirect' ? <RedirectSection /> : null}
      </div>
    </DemoConnContext.Provider>
  )
}
