import { useEffect, useState } from 'react'

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
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 20, maxWidth: 1000, margin: '0 auto' }}>
      <h2>ERP Simulator (Webhook Receiver)</h2>
      <p style={{ marginTop: 0, color: '#555' }}>
        This app receives webhooks on <code>/webhooks/securedapp</code> and shows them below. It also has an optional
        “register webhook” button (requires an admin bearer token in server env).
      </p>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={refresh} disabled={busy}>
          Refresh
        </button>
        <button onClick={onClear} disabled={busy}>
          Clear
        </button>
        <span style={{ color: '#555' }}>Events: {events.length}</span>
      </div>

      <div style={{ marginTop: 16, padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
        <h3 style={{ marginTop: 0 }}>Register webhook in CMS (optional)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <label>
            Webhook URL (leave blank to use server default)
            <input value={registerUrl} onChange={(e) => setRegisterUrl(e.target.value)} style={{ width: '100%', padding: 8, marginTop: 4 }} />
          </label>
          <label>
            Secret (optional)
            <input value={registerSecret} onChange={(e) => setRegisterSecret(e.target.value)} style={{ width: '100%', padding: 8, marginTop: 4 }} />
          </label>
        </div>
        <div style={{ marginTop: 12 }}>
          <button onClick={onRegister} disabled={busy}>
            Register webhook
          </button>
        </div>
      </div>

      {error ? (
        <div style={{ marginTop: 12, color: '#b00020' }}>
          <strong>Error:</strong> {error}
        </div>
      ) : null}

      <div style={{ marginTop: 16 }}>
        {events.map((e) => (
          <div key={e.id} style={{ padding: 12, border: '1px solid #ddd', borderRadius: 8, marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <strong>{e.headers?.['x-webhook-event'] || 'event'}</strong>
                <div style={{ color: '#555' }}>{e.received_at}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div>
                  <strong>signature</strong>: {e.signature ? 'present' : 'none'}
                </div>
                <div>
                  <strong>verify</strong>: {e.verification?.ok ? 'ok' : 'fail'} ({e.verification?.reason})
                </div>
              </div>
            </div>
            <pre style={{ marginTop: 10, whiteSpace: 'pre-wrap' }}>{JSON.stringify(e.body, null, 2)}</pre>
          </div>
        ))}
      </div>
    </div>
  )
}

export default App
