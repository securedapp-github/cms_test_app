import { useEffect, useMemo, useState } from 'react'

async function api(path, options) {
  const res = await fetch(path, {
    headers: { 'content-type': 'application/json' },
    ...options,
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error((data && data.error) || `Request failed: ${res.status}`)
  return data
}

function App() {
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
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 20, maxWidth: 900, margin: '0 auto' }}>
      <h2>Consent Demo (Public API)</h2>
      <p style={{ marginTop: 0, color: '#555' }}>
        This UI calls the local Node proxy (so your <code>x-api-key</code> stays in the server).
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
          <h3 style={{ marginTop: 0 }}>Config</h3>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(config, null, 2)}</pre>
        </div>
        <div style={{ padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
          <h3 style={{ marginTop: 0 }}>Active Policy</h3>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(policy, null, 2)}</pre>
        </div>
      </div>

      <div style={{ marginTop: 16, padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
        <h3 style={{ marginTop: 0 }}>Grant / Withdraw</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label>
            Email / identifier
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%', padding: 8, marginTop: 4 }}
              placeholder="user@example.com"
            />
          </label>
          <label>
            Phone number
            <input
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              style={{ width: '100%', padding: 8, marginTop: 4 }}
              placeholder="9876543210"
            />
          </label>
          <label>
            Purpose
            <select
              value={selectedPurposeId}
              onChange={(e) => setSelectedPurposeId(e.target.value)}
              style={{ width: '100%', padding: 8, marginTop: 4 }}
            >
              <option value="">Select purpose...</option>
              {purposes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.required ? 'required' : 'optional'})
                </option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button disabled={loading || !selectedPurposeId || !policyVersionId} onClick={onGrant}>
            {loading ? 'Working...' : 'Grant consent'}
          </button>
          <button disabled={loading || !selectedPurposeId} onClick={onWithdraw}>
            {loading ? 'Working...' : 'Withdraw consent'}
          </button>
        </div>

        {error ? (
          <div style={{ marginTop: 12, color: '#b00020' }}>
            <strong>Error:</strong> {error}
          </div>
        ) : null}

        {result ? (
          <div style={{ marginTop: 12 }}>
            <strong>Response</strong>
            <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(result, null, 2)}</pre>
          </div>
        ) : null}
      </div>

      <div style={{ marginTop: 16, padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
        <h3 style={{ marginTop: 0 }}>Purposes (Public)</h3>
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(purposes, null, 2)}</pre>
      </div>
    </div>
  )
}

export default App
