import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  clearAccessToken,
  getJSON,
  postJSON,
  setAccessToken,
  setCaregiverId,
  setPersonId,
} from '../api/client'

type AuthMode = 'login' | 'signup'
type Stage = 'credentials' | 'choose-context' | 'create-context' | 'setup-caregiver'

type CareContext = {
  person_id: string
  name: string
  role: string
  permissions: string[]
}

type Account = {
  id: string
  email: string
  display_name?: string | null
}

type LoginResponse = {
  access_token: string
  token_type: 'bearer'
  expires_at: string
  account: Account
}

type CaregiverLink = {
  person_id: string
  caregiver_id: string
  account_id: string
  permissions: string[]
}

export default function Login() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<AuthMode>('login')
  const [stage, setStage] = useState<Stage>('credentials')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [contextName, setContextName] = useState('')
  const [contexts, setContexts] = useState<CareContext[]>([])
  const [selectedPersonId, setSelectedPersonId] = useState('')
  const [account, setAccount] = useState<Account | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const continueWithContext = async (context: CareContext) => {
    setSelectedPersonId(context.person_id)
    const links = await getJSON(`/auth/my-caregiver-links?person_id=${encodeURIComponent(context.person_id)}`) as CaregiverLink[]
    const ownLink = links.find((link) => link.account_id === account?.id)
    if (ownLink) {
      setPersonId(context.person_id)
      setCaregiverId(ownLink.caregiver_id)
      navigate('/')
      return
    }
    setStage('setup-caregiver')
  }

  const handleCredentials = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (mode === 'signup') {
        await postJSON('/auth/signup', {
          email,
          password,
          display_name: displayName.trim() || undefined,
        })
      }
      const session = await postJSON('/auth/login', { email, password }) as LoginResponse
      if (!session?.access_token || !session.account?.id) {
        throw new Error('The authentication response was incomplete.')
      }
      setAccessToken(session.access_token)
      setAccount(session.account)
      const availableContexts = await getJSON('/auth/care-contexts') as CareContext[]
      setContexts(availableContexts)
      if (availableContexts.length === 0) {
        setStage('create-context')
      } else if (availableContexts.length === 1) {
        await continueWithContext(availableContexts[0])
      } else {
        setStage('choose-context')
      }
    } catch (cause) {
      clearAccessToken()
      setError(cause instanceof Error ? cause.message : 'Could not authenticate. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const handleCreateContext = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const context = await postJSON('/auth/care-contexts', { name: contextName.trim() }) as CareContext
      setContexts([context])
      setSelectedPersonId(context.person_id)
      setStage('setup-caregiver')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create the care record.')
    } finally {
      setBusy(false)
    }
  }

  const handleSetupCaregiver = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!account || !selectedPersonId) {
      setError('Sign in and select a care record before setting up caregiver access.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const caregiver = await postJSON('/caregivers', {
        name: account.display_name?.trim() || account.email.split('@')[0],
        email: account.email,
        relationship: 'family caregiver',
        person_id: selectedPersonId,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      }) as { id: string }
      if (!caregiver?.id) throw new Error('The backend did not return a caregiver ID.')

      const invitation = await postJSON('/auth/caregiver-invitations', {
        person_id: selectedPersonId,
        caregiver_id: caregiver.id,
        permissions: ['read', 'write'],
      }) as { invitation_token: string }
      if (!invitation?.invitation_token) throw new Error('The backend did not return an invitation token.')

      await postJSON('/auth/caregiver-invitations/accept', { token: invitation.invitation_token })
      setPersonId(selectedPersonId)
      setCaregiverId(caregiver.id)
      navigate('/')
    } catch (cause) {
      setError(cause instanceof Error
        ? cause.message
        : 'Could not link your caregiver identity. If a caregiver record already uses this email, ask its owner to issue an invitation.')
    } finally {
      setBusy(false)
    }
  }

  const selectedContext = contexts.find((context) => context.person_id === selectedPersonId)

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '24px' }}>
      <section style={{ maxWidth: '480px', width: '100%', padding: '32px 24px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <span aria-hidden="true" style={{ fontSize: '42px', display: 'block', marginBottom: '12px' }}>🏠</span>
          <h1 style={{ fontSize: '22px', fontWeight: 650, color: 'var(--text)' }}>SolenOS</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '8px' }}>
            Sign in to your account to access your Living Care Record.
          </p>
        </div>

        {stage === 'credentials' && (
          <>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              {(['login', 'signup'] as AuthMode[]).map((option) => (
                <button key={option} type="button" onClick={() => { setMode(option); setError('') }}
                  aria-pressed={mode === option}
                  style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: mode === option ? 'var(--accent-soft)' : 'var(--bg)', color: 'var(--text)', cursor: 'pointer' }}>
                  {option === 'login' ? 'Sign in' : 'Create account'}
                </button>
              ))}
            </div>
            <form onSubmit={handleCredentials}>
              {mode === 'signup' && (
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text)', marginBottom: '14px' }}>
                  Your name
                  <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" maxLength={120}
                    style={fieldStyle} placeholder="Name" />
                </label>
              )}
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text)', marginBottom: '14px' }}>
                Email
                <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email"
                  style={fieldStyle} placeholder="you@example.com" />
              </label>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text)', marginBottom: '20px' }}>
                Password
                <input type="password" required minLength={mode === 'signup' ? 12 : 1} maxLength={1024} value={password}
                  onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  style={fieldStyle} placeholder={mode === 'signup' ? 'At least 12 characters' : 'Password'} />
              </label>
              <button type="submit" disabled={busy}
                style={primaryButtonStyle}>
                {busy ? 'Please wait…' : mode === 'signup' ? 'Create account and continue' : 'Sign in'}
              </button>
            </form>
          </>
        )}

        {stage === 'choose-context' && (
          <div>
            <h2 style={sectionHeadingStyle}>Choose a care record</h2>
            <p style={helpTextStyle}>Select the care record you are authorized to access.</p>
            <div style={{ display: 'grid', gap: '10px' }}>
              {contexts.map((context) => (
                <button key={context.person_id} type="button" disabled={busy}
                  onClick={async () => {
                    setBusy(true); setError('')
                    try { await continueWithContext(context) }
                    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load this care record.') }
                    finally { setBusy(false) }
                  }}
                  style={{ textAlign: 'left', padding: '14px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', cursor: 'pointer' }}>
                  <strong>{context.name}</strong>
                  <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>{context.role}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {stage === 'create-context' && (
          <form onSubmit={handleCreateContext}>
            <h2 style={sectionHeadingStyle}>Create a care record</h2>
            <p style={helpTextStyle}>Enter the name of the person whose care you are coordinating. This creates a private care record for your account.</p>
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text)', marginBottom: '18px' }}>
              Care recipient's name
              <input required value={contextName} onChange={(event) => setContextName(event.target.value)} maxLength={200}
                style={fieldStyle} placeholder="Name" />
            </label>
            <button type="submit" disabled={busy} style={primaryButtonStyle}>{busy ? 'Creating…' : 'Create care record'}</button>
          </form>
        )}

        {stage === 'setup-caregiver' && (
          <form onSubmit={handleSetupCaregiver}>
            <h2 style={sectionHeadingStyle}>Set up caregiver access</h2>
            <p style={helpTextStyle}>
              {selectedContext
                ? `Your account has access to “${selectedContext.name}”, but no caregiver identity is linked to it yet.`
                : 'Your care record is created. Set up your caregiver identity to record care under your account.'}
            </p>
            <p style={helpTextStyle}>SolenOS will create a caregiver record for your account and link it to this care record. If your email is already assigned to an existing caregiver record, the backend may require an invitation instead.</p>
            <button type="submit" disabled={busy} style={primaryButtonStyle}>{busy ? 'Setting up…' : 'Set up my caregiver access'}</button>
          </form>
        )}

        {error && (
          <p role="alert" style={{ marginTop: '18px', padding: '12px', borderRadius: '8px', background: 'var(--danger-soft, #fff1f1)', color: 'var(--danger, #9f1d1d)', fontSize: '13px' }}>
            {error}
          </p>
        )}
        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '22px', lineHeight: 1.5 }}>
          SolenOS access is tied to an authenticated account and explicit care-record permissions. Selecting a role alone does not grant access.
        </p>
      </section>
    </main>
  )
}

const fieldStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  boxSizing: 'border-box',
  padding: '12px',
  marginTop: '6px',
  borderRadius: '8px',
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text)',
  fontSize: '14px',
}

const primaryButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 18px',
  borderRadius: '10px',
  border: 'none',
  background: 'var(--trust)',
  color: 'white',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer',
}

const sectionHeadingStyle: React.CSSProperties = {
  fontSize: '18px',
  fontWeight: 600,
  color: 'var(--text)',
  marginBottom: '8px',
}

const helpTextStyle: React.CSSProperties = {
  fontSize: '13px',
  color: 'var(--text-secondary)',
  marginBottom: '16px',
  lineHeight: 1.5,
}
