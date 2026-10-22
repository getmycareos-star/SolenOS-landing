import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createAccount, getJSON, loginAccount, postJSON, setPersonId } from '../api/client'

type Mode = 'login' | 'signup'

export default function Login() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [careRecordName, setCareRecordName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (mode === 'signup') {
        await createAccount(email, password, displayName)
        // Creating a care record is explicit: it happens only when the user supplies a name.
        if (careRecordName.trim()) {
          await postJSON('/auth/care-contexts', { name: careRecordName.trim() })
        }
      } else {
        await loginAccount(email, password)
      }

      const contexts = await getJSON('/auth/care-contexts')
      if (Array.isArray(contexts) && contexts.length > 0 && typeof contexts[0]?.person_id === 'string') {
        setPersonId(contexts[0].person_id)
      } else {
        setPersonId('')
      }
      navigate('/')
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Authentication could not be completed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const switchMode = (next: Mode) => {
    setMode(next)
    setError(null)
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <section style={{ maxWidth: '460px', width: '100%', padding: '32px 24px' }}>
        <header style={{ textAlign: 'center', marginBottom: '28px' }}>
          <span aria-hidden="true" style={{ fontSize: '44px', display: 'block', marginBottom: '12px' }}>🏠</span>
          <h1 style={{ fontSize: '24px', fontWeight: 650, color: 'var(--text)' }}>SolenOS</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.5 }}>
            Your Living Care Record, built around what changed, what matters, and what remains uncertain.
          </p>
        </header>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <button type="button" onClick={() => switchMode('login')} aria-pressed={mode === 'login'} style={{
            flex: 1, padding: '11px', borderRadius: '9px', border: `1px solid ${mode === 'login' ? 'var(--accent)' : 'var(--border)'}`,
            background: mode === 'login' ? 'var(--accent-soft)' : 'var(--surface)', color: 'var(--text)', cursor: 'pointer',
          }}>Sign in</button>
          <button type="button" onClick={() => switchMode('signup')} aria-pressed={mode === 'signup'} style={{
            flex: 1, padding: '11px', borderRadius: '9px', border: `1px solid ${mode === 'signup' ? 'var(--accent)' : 'var(--border)'}`,
            background: mode === 'signup' ? 'var(--accent-soft)' : 'var(--surface)', color: 'var(--text)', cursor: 'pointer',
          }}>Create account</button>
        </div>

        <form onSubmit={handleSubmit} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px' }}>
          {mode === 'signup' && (
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text)', marginBottom: '14px' }}>
              Your name (optional)
              <input value={displayName} onChange={event => setDisplayName(event.target.value)} autoComplete="name" maxLength={120}
                style={{ display: 'block', boxSizing: 'border-box', width: '100%', marginTop: '6px', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }} />
            </label>
          )}

          <label style={{ display: 'block', fontSize: '13px', color: 'var(--text)', marginBottom: '14px' }}>
            Email address
            <input type="email" required value={email} onChange={event => setEmail(event.target.value)} autoComplete="email"
              style={{ display: 'block', boxSizing: 'border-box', width: '100%', marginTop: '6px', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }} />
          </label>

          <label style={{ display: 'block', fontSize: '13px', color: 'var(--text)', marginBottom: '14px' }}>
            Password
            <input type="password" required minLength={mode === 'signup' ? 12 : 1} maxLength={1024} value={password}
              onChange={event => setPassword(event.target.value)} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              style={{ display: 'block', boxSizing: 'border-box', width: '100%', marginTop: '6px', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }} />
            {mode === 'signup' && <span style={{ display: 'block', marginTop: '5px', fontSize: '11px', color: 'var(--text-secondary)' }}>Use at least 12 characters.</span>}
          </label>

          {mode === 'signup' && (
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text)', marginBottom: '14px' }}>
              Care record name (optional)
              <input value={careRecordName} onChange={event => setCareRecordName(event.target.value)} maxLength={200}
                placeholder="For example, Mum's care record"
                style={{ display: 'block', boxSizing: 'border-box', width: '100%', marginTop: '6px', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }} />
              <span style={{ display: 'block', marginTop: '5px', fontSize: '11px', color: 'var(--text-secondary)' }}>A record is created only if you enter a name.</span>
            </label>
          )}

          {error && <p role="alert" style={{ color: 'var(--error)', fontSize: '13px', lineHeight: 1.5, marginBottom: '14px' }}>{error}</p>}

          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '12px 20px', borderRadius: '10px', border: 'none',
            background: 'var(--trust)', color: 'white', fontSize: '14px', fontWeight: 600,
            cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1,
          }}>
            {loading ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          You can continue without an account. Cloud care-record features require a verified account session.
        </p>
        <div style={{ textAlign: 'center', marginTop: '8px' }}>
          <Link to="/" style={{ fontSize: '13px', color: 'var(--trust)', textDecoration: 'none' }}>
            Continue without an account →
          </Link>
        </div>
      </section>
    </main>
  )
}
