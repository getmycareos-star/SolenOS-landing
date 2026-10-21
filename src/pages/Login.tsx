import { FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AuthAccount,
  CareContext,
  checkAuthState,
  createCareContext,
  getCareContexts,
  logIn,
  setPersonId,
  signUp,
} from '../api/client'

type AuthMode = 'login' | 'signup'

export default function Login() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [careRecipientName, setCareRecipientName] = useState('')
  const [account, setAccount] = useState<AuthAccount | null>(null)
  const [contexts, setContexts] = useState<CareContext[]>([])
  const [selectedPersonId, setSelectedPersonId] = useState('')
  const [needsContext, setNeedsContext] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const finishWithContext = (context: CareContext) => {
    setPersonId(context.person_id)
    navigate('/')
  }

  const loadContexts = async () => {
    const available = await getCareContexts()
    setContexts(available)
    if (available.length === 1) {
      finishWithContext(available[0])
      return
    }
    if (available.length > 1) {
      setSelectedPersonId(current => available.some(item => item.person_id === current)
        ? current
        : available[0].person_id)
      setNeedsContext(false)
      return
    }
    setNeedsContext(true)
  }

  useEffect(() => {
    let active = true
    void checkAuthState().then(async state => {
      if (!active || !state.authenticated || !state.sessionInfo) return
      setAccount(state.sessionInfo)
      try {
        await loadContexts()
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Could not load your care records.')
      }
    })
    return () => { active = false }
  }, [])

  const handleAuthSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      if (mode === 'signup') {
        await signUp(email, password, displayName)
      }
      const authenticatedAccount = await logIn(email, password)
      setAccount(authenticatedAccount)
      await loadContexts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed. Check your details and try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateContext = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!careRecipientName.trim()) {
      setError('Enter the name of the person whose care you are recording.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const context = await createCareContext(careRecipientName)
      finishWithContext(context)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the care record.')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectContext = () => {
    const selected = contexts.find(item => item.person_id === selectedPersonId)
    if (!selected) {
      setError('Select a care record to continue.')
      return
    }
    finishWithContext(selected)
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '24px' }}>
      <section style={{ maxWidth: '480px', width: '100%', padding: '32px 24px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <span aria-hidden="true" style={{ fontSize: '44px', display: 'block', marginBottom: '12px' }}>🏠</span>
          <h1 style={{ fontSize: '24px', fontWeight: 650, color: 'var(--text)', margin: 0 }}>SolenOS</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.5 }}>
            Sign in to your Living Care Record.
          </p>
        </div>

        {error && <div role="alert" style={{ marginBottom: '16px', padding: '10px 12px', borderRadius: '8px', background: 'var(--error-soft)', color: 'var(--error)', fontSize: '13px' }}>{error}</div>}

        {!account && (
          <>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              <button type="button" onClick={() => { setMode('login'); setError('') }} aria-pressed={mode === 'login'} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: mode === 'login' ? 'var(--accent-soft)' : 'var(--bg)', color: 'var(--text)', cursor: 'pointer' }}>Sign in</button>
              <button type="button" onClick={() => { setMode('signup'); setError('') }} aria-pressed={mode === 'signup'} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: mode === 'signup' ? 'var(--accent-soft)' : 'var(--bg)', color: 'var(--text)', cursor: 'pointer' }}>Create account</button>
            </div>
            <form onSubmit={handleAuthSubmit} style={{ display: 'grid', gap: '14px' }}>
              {mode === 'signup' && (
                <label style={{ display: 'grid', gap: '6px', color: 'var(--text)', fontSize: '13px' }}>
                  Your name
                  <input autoComplete="name" value={displayName} onChange={event => setDisplayName(event.target.value)} required maxLength={120} placeholder="Full name" style={inputStyle} />
                </label>
              )}
              <label style={{ display: 'grid', gap: '6px', color: 'var(--text)', fontSize: '13px' }}>
                Email
                <input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required maxLength={254} placeholder="you@example.com" style={inputStyle} />
              </label>
              <label style={{ display: 'grid', gap: '6px', color: 'var(--text)', fontSize: '13px' }}>
                Password
                <input type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={event => setPassword(event.target.value)} required minLength={mode === 'signup' ? 12 : 1} maxLength={1024} placeholder={mode === 'signup' ? 'At least 12 characters' : 'Your password'} style={inputStyle} />
              </label>
              <button type="submit" disabled={loading} style={primaryButtonStyle}>
                {loading ? 'Please wait…' : mode === 'signup' ? 'Create secure account' : 'Sign in securely'}
              </button>
            </form>
          </>
        )}

        {account && contexts.length > 1 && (
          <div style={{ display: 'grid', gap: '14px' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>Signed in as {account.email}. Choose a care record to continue.</p>
            <label style={{ display: 'grid', gap: '6px', color: 'var(--text)', fontSize: '13px' }}>
              Care record
              <select value={selectedPersonId} onChange={event => setSelectedPersonId(event.target.value)} style={inputStyle}>
                {contexts.map(context => <option key={context.person_id} value={context.person_id}>{context.name}</option>)}
              </select>
            </label>
            <button type="button" onClick={handleSelectContext} style={primaryButtonStyle}>Open care record</button>
          </div>
        )}

        {account && needsContext && (
          <form onSubmit={handleCreateContext} style={{ display: 'grid', gap: '14px' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>Signed in as {account.email}. Create the care record you will manage. Your account will be linked as its first caregiver.</p>
            <label style={{ display: 'grid', gap: '6px', color: 'var(--text)', fontSize: '13px' }}>
              Person receiving care
              <input autoComplete="off" value={careRecipientName} onChange={event => setCareRecipientName(event.target.value)} required maxLength={200} placeholder="Name of person receiving care" style={inputStyle} />
            </label>
            <button type="submit" disabled={loading} style={primaryButtonStyle}>{loading ? 'Creating care record…' : 'Create care record'}</button>
          </form>
        )}
      </section>
    </main>
  )
}

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box' as const,
  padding: '12px 14px',
  borderRadius: '8px',
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text)',
  fontSize: '14px',
  outline: 'none',
}

const primaryButtonStyle = {
  width: '100%',
  padding: '12px 16px',
  borderRadius: '8px',
  border: 'none',
  background: 'var(--trust)',
  color: 'white',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer',
}
