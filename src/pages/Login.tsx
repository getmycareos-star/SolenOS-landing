import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  clearAccessToken,
  clearCareContext,
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
  const [invitationToken, setInvitationToken] = useState('')
  const [contexts, setContexts] = useState<CareContext[]>([])
  const [selectedPersonId, setSelectedPersonId] = useState('')
  const [account, setAccount] = useState<Account | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const continueWithContext = async (context: CareContext, accountId = account?.id) => {
    setSelectedPersonId(context.person_id)
    const links = await getJSON(`/auth/my-caregiver-links?person_id=${encodeURIComponent(context.person_id)}`) as CaregiverLink[]
    const ownLink = links.find((link) => link.account_id === accountId)
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
      clearCareContext()
      setAccessToken(session.access_token)
      setAccount(session.account)
      const availableContexts = await getJSON('/auth/care-contexts') as CareContext[]
      setContexts(availableContexts)
      if (availableContexts.length === 0) {
        setStage('create-context')
      } else if (availableContexts.length === 1) {
        await continueWithContext(availableContexts[0], session.account.id)
      } else {
        setStage('choose-context')
      }
    } catch (cause) {
      clearAccessToken()
      clearCareContext()
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
      await continueWithContext(context, account?.id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create the care record.')
    } finally {
      setBusy(false)
    }
  }

  const handleSetupCaregiver = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const token = invitationToken.trim()
    if (!account || !token) {
      setError('Sign in and enter the invitation token issued to your account email.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const accepted = await postJSON('/auth/caregiver-invitations/accept', { token }) as {
        person_id: string
        caregiver_id: string
      }
      if (!accepted?.person_id || !accepted?.caregiver_id) {
        throw new Error('The backend did not confirm the care-circle membership.')
      }
      setPersonId(accepted.person_id)
      setCaregiverId(accepted.caregiver_id)
      setInvitationToken('')
      navigate('/')
    } catch (cause) {
      setError(cause instanceof Error
        ? cause.message
        : 'Could not accept this invitation. Verify the token and the email on your account.')
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
            <button type="button" onClick={() => { setStage('setup-caregiver'); setError('') }} disabled={busy}
              style={{ ...primaryButtonStyle, marginTop: '10px', background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }}>
              I have an invitation token
            </button>
          </form>
        )}

        {stage === 'setup-caregiver' && (
          <form onSubmit={handleSetupCaregiver}>
            <h2 style={sectionHeadingStyle}>Accept a care-circle invitation</h2>
            <p style={helpTextStyle}>
              {selectedContext
                ? 'Your account has a care context, but your caregiver membership must be confirmed by an invitation.'
                : 'Enter the invitation token shared by a caregiver who already has permission to invite you.'}
            </p>
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text)', marginBottom: '18px' }}>
              Invitation token
              <input required value={invitationToken} onChange={event => setInvitationToken(event.target.value)}
                autoComplete="off" maxLength={256} style={fieldStyle} placeholder="Paste your invitation token" />
            </label>
            <button type="submit" disabled={busy || !invitationToken.trim()} style={primaryButtonStyle}>
              {busy ? 'Verifying invitation…' : 'Accept invitation'}
            </button>
            <button type="button" onClick={() => { setStage(contexts.length ? 'choose-context' : 'create-context'); setError('') }}
              disabled={busy} style={{ ...primaryButtonStyle, marginTop: '10px', background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }}>
              Back
            </button>
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
