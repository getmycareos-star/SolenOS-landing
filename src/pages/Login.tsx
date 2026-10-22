import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  clearAuthSession,
  getJSON,
  postJSON,
  setAuthSession,
  setCaregiverId,
  setPersonId,
} from '../api/client'

interface CareContext {
  person_id: string
  name: string
  role: string
  permissions: string[]
}

export default function Login() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [personName, setPersonName] = useState('')
  const [contexts, setContexts] = useState<CareContext[]>([])
  const [selectedPersonId, setSelectedPersonId] = useState('')
  const [signedIn, setSignedIn] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const returnTo = (location.state as any)?.from?.pathname || '/'

  const activateContext = async (personId: string, availableContexts: CareContext[]) => {
    const context = availableContexts.find(item => item.person_id === personId)
    if (!context) throw new Error('Choose a care record linked to this account.')
    const links = await getJSON('/auth/my-caregiver-links')
    const caregiverLink = Array.isArray(links)
      ? links.find((item: any) => item?.person_id === personId && typeof item?.caregiver_id === 'string')
      : null
    if (!caregiverLink) {
      throw new Error('This account has no verified caregiver identity for the selected care record. Ask the care-record owner to invite or link your caregiver account.')
    }
    setPersonId(personId)
    setCaregiverId(caregiverLink.caregiver_id)
    navigate(returnTo, { replace: true })
  }

  const loadCareContexts = async () => {
    const response = await getJSON('/auth/care-contexts')
    const nextContexts = Array.isArray(response) ? response as CareContext[] : []
    setContexts(nextContexts)
    if (nextContexts.length > 0) {
      const preferred = nextContexts.some(item => item.person_id === selectedPersonId)
        ? selectedPersonId
        : nextContexts[0].person_id
      setSelectedPersonId(preferred)
      await activateContext(preferred, nextContexts)
      return
    }
    setSignedIn(true)
    setError('Your account is signed in but has no care record yet. Enter the care recipient’s name to create one, or sign out if you are using the wrong account.')
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      if (!signedIn) {
        if (mode === 'signup') {
          await postJSON('/auth/signup', {
            email: email.trim().toLowerCase(),
            password,
            display_name: displayName.trim() || undefined,
          })
        }
        const response = await postJSON('/auth/login', {
          email: email.trim().toLowerCase(),
          password,
        }) as any
        if (typeof response?.access_token !== 'string' || !response.access_token) {
          throw new Error('The authentication service did not return a valid session.')
        }
        setAuthSession(response.access_token, response.account?.id)
        setSignedIn(true)
        await loadCareContexts()
        return
      }

      if (contexts.length > 0) {
        await activateContext(selectedPersonId, contexts)
        return
      }

      if (!personName.trim()) {
        throw new Error('Enter the care recipient’s name to create the first care record.')
      }
      await postJSON('/auth/care-contexts', { name: personName.trim() })
      await loadCareContexts()
    } catch (err: any) {
      setError(err?.message || 'Sign-in could not be completed. Check the details and try again.')
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    try {
      await postJSON('/auth/logout', {})
    } catch {
      // Clearing the local token still removes this browser's access.
    }
    clearAuthSession()
    setSignedIn(false)
    setContexts([])
    setSelectedPersonId('')
    setPassword('')
    setError(null)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <form onSubmit={handleSubmit} style={{ maxWidth: 480, width: '100%', padding: '32px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <span style={{ fontSize: 44, display: 'block', marginBottom: 12 }}>⌂</span>
          <h1 style={{ fontSize: 22, fontWeight: 650, color: 'var(--text)' }}>Sign in to SolenOS</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>
            Your Living Care Record is private. Sign in to access care information linked to your account.
          </p>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 }}>
          {!signedIn && (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                <button type="button" onClick={() => { setMode('login'); setError(null) }} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: mode === 'login' ? 'var(--accent-soft)' : 'var(--bg)', color: 'var(--text)' }}>Sign in</button>
                <button type="button" onClick={() => { setMode('signup'); setError(null) }} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: mode === 'signup' ? 'var(--accent-soft)' : 'var(--bg)', color: 'var(--text)' }}>Create account</button>
              </div>
              {mode === 'signup' && (
                <label style={{ display: 'block', fontSize: 13, marginBottom: 14 }}>
                  Your name
                  <input value={displayName} onChange={e => setDisplayName(e.target.value)} autoComplete="name" maxLength={120} placeholder="Name" style={inputStyle} />
                </label>
              )}
              <label style={{ display: 'block', fontSize: 13, marginBottom: 14 }}>
                Email
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" maxLength={254} placeholder="you@example.com" style={inputStyle} />
              </label>
              <label style={{ display: 'block', fontSize: 13, marginBottom: 18 }}>
                Password
                <input type="password" required minLength={mode === 'signup' ? 12 : 1} value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} placeholder={mode === 'signup' ? 'At least 12 characters' : 'Password'} style={inputStyle} />
              </label>
            </>
          )}

          {signedIn && contexts.length > 0 && (
            <label style={{ display: 'block', fontSize: 13, marginBottom: 18 }}>
              Choose a care record
              <select value={selectedPersonId} onChange={e => setSelectedPersonId(e.target.value)} style={inputStyle}>
                {contexts.map(context => <option key={context.person_id} value={context.person_id}>{context.name}</option>)}
              </select>
            </label>
          )}

          {signedIn && contexts.length === 0 && (
            <label style={{ display: 'block', fontSize: 13, marginBottom: 18 }}>
              Care recipient’s name
              <input required value={personName} onChange={e => setPersonName(e.target.value)} maxLength={200} placeholder="Name of the person you care for" style={inputStyle} />
            </label>
          )}

          {error && <p role="alert" style={{ color: 'var(--error)', fontSize: 13, lineHeight: 1.5, marginBottom: 16 }}>{error}</p>}

          <button type="submit" disabled={loading} style={{ width: '100%', padding: 12, borderRadius: 9, border: 'none', background: loading ? 'var(--text-secondary)' : 'var(--trust)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: loading ? 'wait' : 'pointer' }}>
            {loading ? 'Please wait…' : signedIn ? (contexts.length > 0 ? 'Open care record' : 'Create care record') : mode === 'signup' ? 'Create account and continue' : 'Sign in'}
          </button>
          {signedIn && <button type="button" onClick={signOut} disabled={loading} style={{ width: '100%', marginTop: 10, padding: 10, borderRadius: 9, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)' }}>Sign out</button>}
        </div>
      </form>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  display: 'block',
  boxSizing: 'border-box',
  width: '100%',
  padding: '11px 12px',
  marginTop: 6,
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text)',
  fontSize: 14,
  outline: 'none',
}
