import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { loginWithPassword, registerCaregiverAccount, AuthAccount } from '../api/client'

type Mode = 'login' | 'register'

export default function Login() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [caregiverName, setCaregiverName] = useState('')
  const [personName, setPersonName] = useState('')
  const [relationship, setRelationship] = useState('Family caregiver')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  function continueByRole(account: AuthAccount) {
    if (account.role === 'team') navigate('/team')
    else if (account.role === 'professional') navigate('/professional')
    else navigate('/')
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true); setError(null)
    try {
      const account = mode === 'login'
        ? await loginWithPassword(email.trim(), password)
        : await registerCaregiverAccount({
            email: email.trim(), password,
            name: caregiverName.trim(), person_name: personName.trim(), relationship,
          })
      continueByRole(account)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Authentication could not be completed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 20 }}>
      <section style={{ maxWidth: 480, width: '100%', padding: 28, borderRadius: 16, border: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <span style={{ fontSize: 42, display: 'block' }}>🏠</span>
          <h1 style={{ fontSize: 23, fontWeight: 650, marginTop: 8 }}>SolenOS</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 8 }}>Secure access to care records. A role selection is not authentication; the backend determines your account permissions.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <button type="button" onClick={() => { setMode('login'); setError(null) }} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: mode === 'login' ? 'var(--accent-soft)' : 'var(--bg)' }}>Sign in</button>
          <button type="button" onClick={() => { setMode('register'); setError(null) }} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: mode === 'register' ? 'var(--accent-soft)' : 'var(--bg)' }}>Create caregiver account</button>
        </div>
        {error && <p role="alert" style={{ color: 'var(--error)', fontSize: 13, marginBottom: 14 }}>{error}</p>}
        <form onSubmit={submit} style={{ display: 'grid', gap: 13 }}>
          <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>Email
            <input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} style={{ padding: 11, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)' }} />
          </label>
          <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>Password
            <input required type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'register' ? 12 : 1} value={password} onChange={e => setPassword(e.target.value)} style={{ padding: 11, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)' }} />
            {mode === 'register' && <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Use at least 12 characters.</span>}
          </label>
          {mode === 'register' && <>
            <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>Your name
              <input required value={caregiverName} onChange={e => setCaregiverName(e.target.value)} style={{ padding: 11, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)' }} />
            </label>
            <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>Care recipient name
              <input required value={personName} onChange={e => setPersonName(e.target.value)} style={{ padding: 11, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)' }} />
            </label>
            <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>Relationship
              <input required value={relationship} onChange={e => setRelationship(e.target.value)} style={{ padding: 11, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)' }} />
            </label>
          </>}
          <button type="submit" disabled={busy} style={{ padding: 12, borderRadius: 10, border: 0, background: 'var(--trust)', color: 'white', fontWeight: 600, marginTop: 4 }}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in securely' : 'Create account and care record'}</button>
        </form>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: 18 }}>Professional and SolenOS Team accounts must be provisioned by an administrator. Choosing a role in the browser cannot grant access.</p>
        <div style={{ textAlign: 'center', marginTop: 14 }}><Link to="/" style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Return to dashboard</Link></div>
      </section>
    </main>
  )
}
