import { useEffect, useMemo, useState } from 'react'

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

async function api(path, options) {
  const res = await fetch(path, {
    headers: { 'content-type': 'application/json' },
    ...options,
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

function ConsentSection() {
  const [config, setConfig] = useState(null)
  const [purposes, setPurposes] = useState([])
  const [policy, setPolicy] = useState(null)
  const [email, setEmail] = useState('user@example.com')
  const [phoneNumber, setPhoneNumber] = useState('9876543210')
  const [selectedPurposeId, setSelectedPurposeId] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const policyVersionId = useMemo(() => policy?.policyVersion?.id || null, [policy])

  useEffect(() => {
    ;(async () => {
      try {
        const cfg = await api('/api/config')
        setConfig(cfg)
        const p = await api('/api/purposes')
        setPurposes(p.purposes || [])
        const pol = await api('/api/policy')
        setPolicy(pol || null)
      } catch (e) {
        setError(e.message)
      }
    })()
  }, [])

  async function onGrant() {
    setError(null)
    setResult(null)
    setLoading(true)
    try {
      const data = await api('/api/consent/grant', {
        method: 'POST',
        body: JSON.stringify({
          email,
          phone_number: phoneNumber,
          purpose_id: selectedPurposeId,
          policy_version_id: policyVersionId,
        }),
      })
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
      const data = await api('/api/consent/withdraw', {
        method: 'POST',
        body: JSON.stringify({
          email,
          phone_number: phoneNumber,
          purpose_id: selectedPurposeId,
        }),
      })
      setResult(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <p style={{ color: '#64748b', marginTop: 0 }}>
        Public consent API via this demo server — <code>x-api-key</code> stays on the server.
      </p>
      <div style={grid2}>
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>Config</h3>
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
          <label style={{ gridColumn: '1 / -1' }}>
            Purpose
            <select
              value={selectedPurposeId}
              onChange={(e) => setSelectedPurposeId(e.target.value)}
              style={input}
            >
              <option value="">Select…</option>
              {purposes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button type="button" disabled={loading || !selectedPurposeId || !policyVersionId} onClick={onGrant} style={btn}>
            {loading ? '…' : 'Grant consent'}
          </button>
          <button type="button" disabled={loading || !selectedPurposeId} onClick={onWithdraw} style={btnSec}>
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
  const [events, setEvents] = useState([])
  const [error, setError] = useState(null)
  const [registerUrl, setRegisterUrl] = useState('')
  const [registerSecret, setRegisterSecret] = useState('')
  const [busy, setBusy] = useState(false)

  async function refresh() {
    try {
      const data = await api('/api/events')
      setEvents(data.events || [])
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 2000)
    return () => clearInterval(t)
  }, [])

  async function onClear() {
    setBusy(true)
    setError(null)
    try {
      await api('/api/events/clear', { method: 'POST', body: JSON.stringify({}) })
      await refresh()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function onRegister() {
    setBusy(true)
    setError(null)
    try {
      const body = {}
      if (registerUrl.trim()) body.url = registerUrl.trim()
      if (registerSecret.trim()) body.secret = registerSecret.trim()
      await api('/api/webhooks/register', { method: 'POST', body: JSON.stringify(body) })
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <p style={{ color: '#64748b', marginTop: 0 }}>
        Receiver: <code>/webhooks/securedapp</code> on the demo API port (see Config tab). Register webhook in CMS with
        that URL.
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
      <div style={{ ...card, marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Register webhook (needs CMS_ADMIN_BEARER_TOKEN)</h3>
        <div style={grid2}>
          <label>
            URL (optional override)
            <input value={registerUrl} onChange={(e) => setRegisterUrl(e.target.value)} style={input} />
          </label>
          <label>
            Secret (optional)
            <input value={registerSecret} onChange={(e) => setRegisterSecret(e.target.value)} style={input} />
          </label>
        </div>
        <button type="button" style={{ ...btn, marginTop: 12 }} onClick={onRegister} disabled={busy}>
          Register in CMS
        </button>
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
  const [purposeId, setPurposeId] = useState('')
  const [policyVersionId, setPolicyVersionId] = useState('')
  const [email, setEmail] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)

  async function onPrefill() {
    setBusy(true)
    setResult(null)
    try {
      const data = await api('/api/redirect/prefill')
      const purposes = data.purposes || []
      if (purposes.length > 0) setPurposeId(purposes[0].id)
      if (data.policy?.policyVersion?.id) setPolicyVersionId(data.policy.policyVersion.id)
      setResult({ message: 'Prefill OK', purposes: purposes.length })
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
      const data = await api('/api/redirect/request', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          phone_number: phoneNumber.trim(),
          purpose_id: purposeId.trim(),
          policy_version_id: policyVersionId.trim(),
        }),
      })
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

  return (
    <div>
      <p style={{ color: '#64748b', marginTop: 0 }}>
        Redirect flow uses the same server-side API key as Consent. Allow popups for{' '}
        <code>{typeof window !== 'undefined' ? window.location.origin : ''}</code>.
      </p>
      <div style={card}>
        <div style={grid2}>
          <label>
            purpose_id
            <input value={purposeId} onChange={(e) => setPurposeId(e.target.value)} style={input} placeholder="UUID" />
          </label>
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
          <button type="button" style={btn} disabled={busy} onClick={onCreate}>
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

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}>
      <h1 style={{ margin: '0 0 8px', fontSize: 26 }}>Unified CMS demo</h1>
      <p style={{ margin: '0 0 20px', color: '#64748b' }}>
        One Node API (<code>:5050</code>) + one UI (<code>:5175</code>). Start CMS on <code>:3000</code>, then{' '}
        <code>npm run demo:all</code> from the monorepo.
      </p>
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
  )
}
