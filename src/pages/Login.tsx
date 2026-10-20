import { FormEvent, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { getJSON, postJSON, setAccessToken, setPersonId } from '../api/client'

type AuthMode = 'login' | 'signup'
type CareContext = {
  person_id: string
  name: string
  role: string
  permissions: string[]
}

export default function Login() {
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [personName, setPersonName] = useState('')
  const [availableContexts, setAvailableContexts] = useState<CareContext[]>([])
  const [selectedPersonId, setSelectedPersonId] = useState('')
  const [needsCareContext, setNeedsCareContext] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  const finishWithContext = (personId: string) => {
    setPersonId(personId)
    navigate('/', { replace: true })
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    let accountCreated = false

    try {
      if (mode === 'signup') {
        if (!displayName.trim()) throw new Error('Enter your name.')
        if (!personName.trim()) throw new Error('Enter the name of the person whose care record you are creating.')

        await postJSON('/auth/signup', {
          email: email.trim(),
          password,
          display_name: displayName.trim(),
        })
        accountCreated = true
      }

      const auth = await postJSON('/auth/login', { email: email.trim(), password })
      if (!auth?.access_token) throw new Error('The server did not return a session token.')
      setAccessToken(auth.access_token)

      if (mode === 'signup') {
        const context = await postJSON('/auth/care-contexts', { name: personName.trim() }) as CareContext
        finishWithContext(context.person_id)
        return
      }

      const contexts = await getJSON('/auth/care-contexts') as CareContext[]
      if (contexts.length === 0) {
        setNeedsCareContext(true)
        setError('Your account has no care record yet. Enter the care recipient’s name below to create one.')
        return
      }
      if (contexts.length === 1) {
        finishWithContext(contexts[0].person_id)
        return
      }

      setAvailableContexts(contexts)
      setSelectedPersonId(contexts[0].person_id)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to sign in. Try again.'
      setError(accountCreated
        ? 'Your account was created, but setup did not finish. Switch to Sign in and continue.'
        : message)
      if (accountCreated) setMode('login')
    } finally {
      setBusy(false)
    }
  }

  const handleCreateCareContext = async () => {
    setError('')
    if (!personName.trim()) {
      setError('Enter the care recipient’s name.')
      return
    }
    setBusy(true)
    try {
      const context = await postJSON('/auth/care-contexts', { name: personName.trim() }) as CareContext
      finishWithContext(context.person_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create the care record.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ maxWidth: '480px', width: '100%', padding: '32px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <span style={{ fontSize: '48px', marginBottom: '16px', display: 'block' }}>🏠</span>
          <h1 style={{ fontSize: '22px', fontWeight: 650, color: 'var(--text)' }}>SolenOS</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px' }}>
            Secure access to your family’s Living Care Record.
          </p>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
            {(['login', 'signup'] as AuthMode[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => { setMode(item); setError(''); setNeedsCareContext(false); setAvailableContexts([]) }}
                disabled={busy}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: `1px solid ${mode === item ? 'var(--accent)' : 'var(--border)'}`,
                  background: mode === item ? 'var(--accent-soft)' : 'var(--bg)',
                  color: 'var(--text)',
                  cursor: busy ? 'wait' : 'pointer',
                  fontWeight: mode === item ? 600 : 400,
                }}
              >
                {item === 'login' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          {availableContexts.length > 1 ? (
            <div>
              <label htmlFor="care-context" style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: 'var(--text)' }}>
                Choose a care record
              </label>
              <select
                id="care-context"
                value={selectedPersonId}
                onChange={(event) => setSelectedPersonId(event.target.value)}
                style={{ width: '100%', padding: '12px', marginBottom: '16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
              >
                {availableContexts.map((context) => (
                  <option key={context.person_id} value={context.person_id}>{context.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => finishWithContext(selectedPersonId)}
                disabled={!selectedPersonId || busy}
                style={{ width: '100%', padding: '12px 20px', borderRadius: '10px', border: 'none', background: 'var(--trust)', color: 'white', fontSize: '14px', fontWeight: 600, cursor: busy ? 'wait' : 'pointer' }}
              >
                Continue
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {mode === 'signup' && (
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text)', marginBottom: '14px' }}>
                  Your name
                  <input
                    autoComplete="name"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    required
                    maxLength={120}
                    style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: '12px', marginTop: '6px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
                  />
                </label>
              )}

              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text)', marginBottom: '14px' }}>
                Email address
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  maxLength={254}
                  style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: '12px', marginTop: '6px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
                />
              </label>

              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text)', marginBottom: '14px' }}>
                Password
                <input
                  type="password"
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={mode === 'signup' ? 12 : 1}
                  maxLength={1024}
                  style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: '12px', marginTop: '6px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
                />
                {mode === 'signup' && <span style={{ display: 'block', marginTop: '5px', fontSize: '11px', color: 'var(--text-secondary)' }}>Use at least 12 characters.</span>}
              </label>

              {(mode === 'signup' || needsCareContext) && (
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text)', marginBottom: '18px' }}>
                  Care recipient’s name
                  <input
                    value={personName}
                    onChange={(event) => setPersonName(event.target.value)}
                    required
                    maxLength={200}
                    placeholder="Name for the Living Care Record"
                    style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: '12px', marginTop: '6px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
                  />
                </label>
              )}

              {error && (
                <p role="alert" style={{ fontSize: '13px', color: 'var(--danger, #b42318)', margin: '0 0 16px' }}>
                  {error}
                </p>
              )}

              {needsCareContext ? (
                <button
                  type="button"
                  onClick={handleCreateCareContext}
                  disabled={busy}
                  style={{ width: '100%', padding: '12px 20px', borderRadius: '10px', border: 'none', background: 'var(--trust)', color: 'white', fontSize: '14px', fontWeight: 600, cursor: busy ? 'wait' : 'pointer' }}
                >
                  {busy ? 'Creating…' : 'Create care record'}
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={busy}
                  style={{ width: '100%', padding: '12px 20px', borderRadius: '10px', border: 'none', background: 'var(--trust)', color: 'white', fontSize: '14px', fontWeight: 600, cursor: busy ? 'wait' : 'pointer' }}
                >
                  {busy ? 'Please wait…' : mode === 'signup' ? 'Create account and care record' : 'Sign in'}
                </button>
              )}
            </form>
          )}
        </div>

        <p style={{ fontSize: '12px', lineHeight: 1.5, textAlign: 'center', color: 'var(--text-secondary)', marginTop: '18px' }}>
          Caregiver sign-in is supported. Professional and SolenOS team access will remain unavailable until separate verified roles and permissions are implemented.
        </p>
        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <Link to="/" style={{ fontSize: '12px', color: 'var(--text-secondary)', textDecoration: 'none' }}>
            Return to dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
