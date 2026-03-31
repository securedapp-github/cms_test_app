import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const LS_KEY = 'securedapp-unified-demo-connection-v1'

const card = {
  padding: 16,
  border: '1px solid #cbd5e1',
  borderRadius: 10,
  background: '#fff',
  marginBottom: 16,
}
const input = { width: '100%', padding: 8, marginTop: 4, borderRadius: 8, border: '1px solid #cbd5e1' }
const btn = {
  padding: '10px 16px',
  borderRadius: 8,
  border: 'none',
  cursor: 'pointer',
  fontWeight: 600,
  background: '#4f46e5',
  color: '#fff',
}
const btnSec = { ...btn, background: '#0f766e' }
const grid2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }

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
  const res = await fetch(path, {
    ...options,
    headers: { ...base, ...(options?.headers || {}) },
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error((data && data.error) || `Request failed: ${res.status}`)
  return data
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
    <div style={{ ...card, background: '#f8fafc', borderColor: '#94a3b8' }}>
      <h2 style={{ marginTop: 0, fontSize: 18 }}>CMS connection</h2>
      <p style={{ marginTop: 0, color: '#64748b', fontSize: 14 }}>
        Enter your CMS details here once — saved in <strong>this browser only</strong> (localStorage). No redeploy needed.
        The demo API forwards <code>x-api-key</code> to your CMS; treat this like a dev tool, not a vault.
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
        style={{ ...btn, marginTop: 12 }}
        onClick={() => saveConn(draft)}
      >
        Save connection
      </button>
    </div>
  )
}

function ConsentSection() {
  const { conn, connVersion } = useContext(DemoConnContext)
  const [config, setConfig] = useState(null)
  const [purposes, setPurposes] = useState([])
  const [policy, setPolicy] = useState(null)
  const [email, setEmail] = useState('user@example.com')
  const [phoneNumber, setPhoneNumber] = useState('9876543210')
  const [selectedPurposeIds, setSelectedPurposeIds] = useState([])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const policyVersionId = useMemo(() => policy?.policyVersion?.id || null, [policy])

  useEffect(() => {
    setError(null)
    setConfig(null)
    setPurposes([])
    setPolicy(null)
    setSelectedPurposeIds([])
    ;(async () => {
      try {
        const cfg = await api('/api/config', {}, conn)
        setConfig(cfg)
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
      <p style={{ color: '#64748b', marginTop: 0 }}>
        Uses the connection above. The demo server adds your <code>x-api-key</code> when calling the CMS (browser → demo → CMS).
      </p>
      <div style={grid2}>
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>Resolved config</h3>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 12 }}>{JSON.stringify(config, null, 2)}</pre>
        </div>
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>Active policy</h3>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 12 }}>{JSON.stringify(policy, null, 2)}</pre>
        </div>
      </div>
      <div style={card}>
        <h3 style={{ marginTop: 0 }}>Grant / withdraw</h3>
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
                  <div key={p.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 10 }}>
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
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button
            type="button"
            disabled={loading || selectedPurposeIds.length === 0 || !policyVersionId}
            onClick={onGrant}
            style={btn}
          >
            {loading ? '…' : 'Grant consent'}
          </button>
          <button type="button" disabled={loading || selectedPurposeIds.length === 0} onClick={onWithdraw} style={btnSec}>
            {loading ? '…' : 'Withdraw'}
          </button>
        </div>
        {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}
        {result ? (
          <pre style={{ marginTop: 12, whiteSpace: 'pre-wrap', fontSize: 12 }}>{JSON.stringify(result, null, 2)}</pre>
        ) : null}
      </div>
      <div style={card}>
        <h3 style={{ marginTop: 0 }}>Purposes</h3>
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 12 }}>{JSON.stringify(purposes, null, 2)}</pre>
      </div>
    </div>
  )
}

function ErpSection() {
  const { conn, connVersion } = useContext(DemoConnContext)
  const [events, setEvents] = useState([])
  const [error, setError] = useState(null)
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
    refresh()
    const t = setInterval(refresh, 2000)
    return () => clearInterval(t)
  }, [connVersion, refresh])

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
      <p style={{ color: '#64748b', marginTop: 0 }}>
        This tab shows webhook calls received by the demo endpoint. Configure webhook delivery in CMS to point at the
        webhook URL shown under <strong>Resolved config</strong> on the Consent tab.
      </p>
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
          <div key={e.id} style={{ ...card, marginBottom: 10 }}>
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
            <pre style={{ marginTop: 10, whiteSpace: 'pre-wrap', fontSize: 12 }}>{JSON.stringify(e.body, null, 2)}</pre>
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

  useEffect(() => {
    setResult(null)
    setPurposes([])
    setSelectedPurposeIds([])
  }, [connVersion])

  async function onPrefill() {
    setBusy(true)
    setResult(null)
    try {
      const data = await api('/api/redirect/prefill', {}, conn)
      const fetchedPurposes = data.purposes || []
      setPurposes(fetchedPurposes)
      setSelectedPurposeIds([])
      if (data.policy?.policyVersion?.id) setPolicyVersionId(data.policy.policyVersion.id)
      setResult({ message: 'Prefill OK', purposes: fetchedPurposes.length })
    } catch (e) {
      setResult({ error: e.message })
    } finally {
      setBusy(false)
    }
  }

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
      <p style={{ color: '#64748b', marginTop: 0 }}>
        OTP page opens on the CMS host; your CMS must allow CORS from <code>{typeof window !== 'undefined' ? window.location.origin : ''}</code>.
        Allow popups for this site.
      </p>
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
                  <div key={p.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 10 }}>
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
          <label>
            policy_version_id
            <input
              value={policyVersionId}
              onChange={(e) => setPolicyVersionId(e.target.value)}
              style={input}
              placeholder="UUID"
            />
          </label>
          <label>
            email
            <input value={email} onChange={(e) => setEmail(e.target.value)} style={input} type="email" />
          </label>
          <label>
            phone_number
            <input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} style={input} />
          </label>
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" style={btnSec} disabled={busy} onClick={onPrefill}>
            Prefill from CMS
          </button>
          <button
            type="button"
            style={btn}
            disabled={busy || selectedPurposeIds.length === 0 || !policyVersionId.trim()}
            onClick={onCreate}
          >
            Create redirect + open popup
          </button>
        </div>
      </div>
      <div style={card}>
        <strong>Last response</strong>
        <pre style={{ marginTop: 8, whiteSpace: 'pre-wrap', fontSize: 12 }}>
          {result ? JSON.stringify(result, null, 2) : '—'}
        </pre>
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
      <div style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}>
        <h1 style={{ margin: '0 0 8px', fontSize: 26 }}>Unified CMS demo</h1>
        <p style={{ margin: '0 0 20px', color: '#64748b' }}>
          Production-friendly: configure CMS URL, API key, and app ID in the browser — no server env churn. Deploy the
          static UI + small API once.
        </p>
        <ConnectionPanel />
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
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
