import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

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
  cmsBaseUrl: 'https://cmsbe.securedapp.io',
  apiKey: '',
  appId: '',
}

/** Optional: set VITE_DEMO_API_BASE_URL when the UI is served without same-origin /api (e.g. static CDN + separate demo API host). */
const DEMO_API_BASE = String(import.meta.env.VITE_DEMO_API_BASE_URL || '')
  .trim()
  .replace(/\/+$/, '')

function shouldUseDemoProxy() {
  if (DEMO_API_BASE) return true
  if (typeof window === 'undefined') return false
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
}

function demoFetchPath(path) {
  if (!path.startsWith('/')) return path
  return DEMO_API_BASE ? `${DEMO_API_BASE}${path}` : path
}

function normalizeConsentFlow(raw) {
  const v = String(raw || '').trim().toLowerCase()
  if (v === 'redirect') return 'redirect'
  if (v === 'embedded') return 'embedded'
  return 'unknown'
}

const DemoConnContext = createContext(null)
const ToastContext = createContext(() => {})

function useToast() {
  return useContext(ToastContext)
}

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)
  const showToast = useCallback((message, tone = 'success') => {
    const id = ++idRef.current
    setToasts((prev) => [...prev, { id, message, tone }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3600)
  }, [])
  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div
        style={{
          position: 'fixed',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          alignItems: 'center',
          pointerEvents: 'none',
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            style={{
              padding: '14px 22px',
              borderRadius: 14,
              fontWeight: 700,
              fontSize: 14,
              boxShadow: '0 12px 40px rgba(15,23,42,0.25)',
              background: t.tone === 'error' ? '#b91c1c' : '#0f172a',
              color: '#fff',
              maxWidth: 'min(420px, 92vw)',
              textAlign: 'center',
            }}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

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
  if (shouldUseDemoProxy()) {
    const base = headersFromConn(conn)
    const url = demoFetchPath(path)
    try {
      const res = await fetch(url, {
        ...options,
        headers: { ...base, ...(options?.headers || {}) },
      })
      const data = await res.json().catch(() => null)
      if (res.ok) return data

      // If demo proxy is unavailable in deployment, fallback to direct CMS public APIs.
      if ([404, 502, 503, 504].includes(res.status)) {
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

  const direct = await cmsFallback(path, options, conn)
  if (direct !== null) return direct
  throw new Error('Demo API base is not configured for this deployment')
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
    case '/api/consent/initiate':
      return directFetch(`/public/apps/${appId}/consent/initiate`, 'POST', body, true)
    default:
      if (path.startsWith('/api/consent/guardian/') && path.endsWith('/nominate')) {
        const token = path.split('/')[4]
        return directFetch(`/public/consent/guardian/${token}/nominate`, 'POST', body, false)
      }
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
  const showToast = useToast()
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
      <h2 style={{ ...sectionTitle, marginBottom: 6 }}>Fiduciary Server Config</h2>
      <p style={{ marginTop: 0, ...muted, fontSize: 14, lineHeight: 1.5 }}>
        Enter your CMS details here once — saved in <strong>this browser only</strong> (localStorage). No redeploy needed.
        The demo API forwards <code>x-api-key</code> to your CMS; treat this like a dev tool, not a vault.
      </p>
      <p style={{ marginTop: -4, color: '#475569', fontSize: 13 }}>
        Default CMS URL is production <strong>https://cmsbe.securedapp.io</strong>. For sandbox use{' '}
        <strong>https://cms-test-be.securedapp.io</strong>.
      </p>
      <div style={grid2}>
        <label style={{ gridColumn: '1 / -1' }}>
          CMS base URL
          <input
            value={draft.cmsBaseUrl}
            onChange={(e) => update('cmsBaseUrl', e.target.value)}
            style={input}
            placeholder="https://cmsbe.securedapp.io"
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
      <button
        type="button"
        style={{ ...btn, marginTop: 14 }}
        onClick={() => {
          saveConn(draft)
          showToast('Connection saved')
        }}
      >
        Save connection
      </button>
    </div>
  )
}

function ConsentSection() {
  const showToast = useToast()
  const { conn, connVersion } = useContext(DemoConnContext)
  const [purposes, setPurposes] = useState([])
  const [policy, setPolicy] = useState(null)
  const [email, setEmail] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [selectedPurposeIds, setSelectedPurposeIds] = useState([])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const policyVersionId = useMemo(() => policy?.policyVersion?.id || null, [policy])
  const consentFlow = useMemo(() => normalizeConsentFlow(policy?.policyVersion?.consent_flow), [policy])
  const embeddedBlocked = consentFlow === 'redirect'

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
      showToast('Consent granted')
    } catch (e) {
      setError(e.message)
      showToast(e.message || 'Grant failed', 'error')
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
      showToast('Consent withdrawn')
    } catch (e) {
      setError(e.message)
      showToast(e.message || 'Withdraw failed', 'error')
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
      showToast('User consent state loaded')
    } catch (e) {
      setError(e.message)
      showToast(e.message || 'Fetch failed', 'error')
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
      {embeddedBlocked ? (
        <p style={{ color: '#b45309', marginTop: 0 }}>
          This app is configured for <strong>redirect</strong> consent flow. Embedded grant/withdraw is blocked.
        </p>
      ) : null}
      {consentFlow === 'unknown' ? (
        <p style={{ color: '#92400e', marginTop: 0 }}>
          Could not resolve app consent flow from active policy. Configure an <strong>active policy version</strong> for this app.
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
            disabled={loading || selectedPurposeIds.length === 0 || !policyVersionId || embeddedBlocked}
            onClick={onGrant}
            style={btn}
          >
            {loading ? '…' : 'Grant consent'}
          </button>
          <button
            type="button"
            disabled={loading || selectedPurposeIds.length === 0 || embeddedBlocked}
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

function RedirectSection() {
  const showToast = useToast()
  const { conn, connVersion } = useContext(DemoConnContext)
  const [purposes, setPurposes] = useState([])
  const [selectedPurposeIds, setSelectedPurposeIds] = useState([])
  const [policyVersionId, setPolicyVersionId] = useState('')
  const [email, setEmail] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [dob, setDob] = useState('1990-01-01')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [consentFlow, setConsentFlow] = useState('unknown')
  
  const [flowState, setFlowState] = useState('idle') // idle, guardian_form, completed
  const [sessionToken, setSessionToken] = useState('')
  const [guardianName, setGuardianName] = useState('')
  const [guardianEmail, setGuardianEmail] = useState('')
  const [guardianPhone, setGuardianPhone] = useState('')

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
        setConsentFlow(normalizeConsentFlow(data.policy?.policyVersion?.consent_flow))
      } catch (e) {
        setResult({ error: e.message })
      } finally {
        setBusy(false)
      }
    })()
  }, [connVersion, conn])

  async function onInitiate() {
    setBusy(true)
    setResult(null)
    try {
      const phone = phoneNumber.trim()
      const initiateBody = {
        email: email.trim(),
        phone_number: phone,
        mobile: phone,
        dob: dob || undefined,
        purpose_ids: selectedPurposeIds,
        callback_url: window.location.origin,
      }
      if (policyVersionId) initiateBody.policy_version_id = policyVersionId

      const data = await api(
        '/api/consent/initiate',
        {
          method: 'POST',
          body: JSON.stringify(initiateBody),
        },
        conn
      )
      
      if (data.flow === 'guardian_required') {
        let extractedToken = data.token;
        if (!extractedToken && (data.redirect_url || data.pop_url)) {
          const urlStr = data.redirect_url || data.pop_url;
          const urlObj = new URL(urlStr, window.location.origin);
          const pathParts = urlObj.pathname.split('/');
          extractedToken = pathParts[pathParts.length - 1];
        }
        setSessionToken(extractedToken)
        setFlowState('guardian_form')
        showToast('Guardian required for minor.')
      } else {
        setResult(data)
        const redirectUrl = data.redirect_url || data.pop_url
        if (!redirectUrl) throw new Error('redirect_url missing')
        const popup = window.open(
          redirectUrl,
          'redirect-consent-popup',
          'popup=yes,width=520,height=760,resizable=yes,scrollbars=yes'
        )
        if (!popup) {
          setResult({ ...data, note: 'Popup blocked — open redirect URL manually.' })
        }
        showToast('Redirect opened — complete OTP in the popup')
      }
    } catch (e) {
      setResult({ error: e.message })
      showToast(e.message || 'Initiate request failed', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function onGuardianSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setResult(null)
    try {
      const data = await api(
        `/api/consent/guardian/${sessionToken}/nominate`,
        {
          method: 'POST',
          body: JSON.stringify({
            guardian_name: guardianName.trim(),
            guardian_email: guardianEmail.trim(),
            guardian_phone: guardianPhone.trim(),
            relationship: 'Parent',
            relation: 'Parent',
          }),
        },
        conn
      )
      setResult(data)
      setFlowState('completed')
      showToast('Consent link sent to guardian email.')
    } catch (e) {
      setResult({ error: e.message })
      showToast(e.message || 'Guardian nomination failed', 'error')
    } finally {
      setBusy(false)
    }
  }

  function onReset() {
    setFlowState('idle')
    setSessionToken('')
    setGuardianName('')
    setGuardianEmail('')
    setGuardianPhone('')
    setResult(null)
  }

  function togglePurpose(purposeId) {
    setSelectedPurposeIds((prev) =>
      prev.includes(purposeId) ? prev.filter((id) => id !== purposeId) : [...prev, purposeId]
    )
  }

  function toggleAllPurposes() {
    setSelectedPurposeIds((prev) => (prev.length === purposes.length ? [] : purposes.map((p) => p.id)))
  }

  if (flowState === 'guardian_form') {
    return (
      <div style={card}>
        <h3 style={sectionTitle}>Guardian Details Required</h3>
        <p style={{ marginTop: 0, color: '#475569', fontSize: 14 }}>
          Since the user is a minor, we need a guardian to approve the consent request.
          Please provide the guardian's details below.
        </p>
        <form onSubmit={onGuardianSubmit} style={{ display: 'grid', gap: 12, marginTop: 16 }}>
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Guardian Name</span>
            <input required value={guardianName} onChange={(e) => setGuardianName(e.target.value)} style={{ ...input, marginTop: 0 }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Guardian Email</span>
            <input required value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)} style={{ ...input, marginTop: 0 }} type="email" />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Guardian Phone</span>
            <input
              required
              value={guardianPhone}
              onChange={(e) => setGuardianPhone(e.target.value)}
              style={{ ...input, marginTop: 0 }}
              type="tel"
              placeholder="+91…"
            />
          </label>
          <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="submit" style={{ ...btn, opacity: busy ? 0.7 : 1, cursor: busy ? 'not-allowed' : 'pointer' }} disabled={busy}>
              {busy ? 'Submitting...' : 'Submit Guardian Details'}
            </button>
            <button type="button" style={btnSec} onClick={onReset} disabled={busy}>Cancel</button>
          </div>
        </form>
        {result?.error ? <p style={{ color: '#b91c1c', marginTop: 12 }}>{result.error}</p> : null}
      </div>
    )
  }

  if (flowState === 'completed') {
    return (
      <div style={card}>
        <h3 style={sectionTitle}>Consent Request Sent</h3>
        <p style={{ marginTop: 0, color: '#166534', fontSize: 15 }}>
          Consent link sent to guardian email. They will complete the process.
        </p>
        <button type="button" style={{ ...btn, marginTop: 16 }} onClick={onReset}>
          Start Over
        </button>
      </div>
    )
  }

  return (
    <div>
      <p style={{ ...muted, marginTop: 0 }}>
        We use the latest active policy automatically. Select purpose(s), enter user details, and open the OTP consent popup.
      </p>
      {consentFlow === 'embedded' ? (
        <p style={{ color: '#b45309', marginTop: 0 }}>
          This app is configured for <strong>embedded</strong> consent flow. Redirect request is blocked.
        </p>
      ) : null}
      {consentFlow === 'unknown' ? (
        <p style={{ color: '#92400e', marginTop: 0 }}>
          Could not resolve app consent flow from active policy. Configure an <strong>active policy version</strong> for this app.
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
          <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', color: '#475569', fontSize: 14 }}>
            Active policy: <strong style={{ marginLeft: 6 }}>{policyVersionId ? 'Auto-selected' : 'Not available'}</strong>
          </div>
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Email</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} style={{ ...input, marginTop: 0 }} type="email" autoComplete="email" />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Phone number</span>
            <input
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              style={{ ...input, marginTop: 0 }}
              type="tel"
              autoComplete="tel"
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Date of Birth</span>
            <input
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              style={{ ...input, marginTop: 0 }}
              type="date"
            />
          </label>
        </div>
        <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            style={{ ...btn, opacity: busy ? 0.7 : 1, cursor: busy ? 'not-allowed' : 'pointer' }}
            disabled={busy || selectedPurposeIds.length === 0 || consentFlow === 'embedded'}
            onClick={onInitiate}
          >
            {busy ? 'Initiating...' : 'Initiate Consent Flow'}
          </button>
        </div>
      </div>
      <div style={card}>
        <strong style={{ fontSize: 15 }}>Status</strong>
        <p style={{ marginTop: 8, color: result?.error ? '#b91c1c' : '#166534' }}>
          {result ? (result.error || 'Request completed successfully.') : '—'}
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
    <ToastProvider>
      <DemoConnContext.Provider value={ctx}>
        <div style={pageWrap}>
          <h1 style={{ margin: '0 0 20px', fontSize: 30, letterSpacing: '-0.01em' }}>Unified CMS demo</h1>
          <ConnectionPanel />
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
            <TabButton active={tab === 'consent'} onClick={() => setTab('consent')}>
              Consent (embedded)
            </TabButton>
            <TabButton active={tab === 'redirect'} onClick={() => setTab('redirect')}>
              Redirect consent
            </TabButton>
          </div>
          {tab === 'consent' ? <ConsentSection /> : null}
          {tab === 'redirect' ? <RedirectSection /> : null}
        </div>
      </DemoConnContext.Provider>
    </ToastProvider>
  )
}
