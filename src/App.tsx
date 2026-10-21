import { useCallback, useEffect, useState } from 'react'
import { Navigate, Outlet, Routes, Route, useNavigate } from 'react-router-dom'
import {
  ApiError,
  clearAccessToken,
  clearCareContext,
  getAccessToken,
  getCaregiverId,
  getJSON,
  getPersonId,
  postJSON,
} from './api/client'
import Dashboard from './pages/Dashboard'
import DailyCare from './pages/DailyCare'
import StructuredDailyCapture from './pages/StructuredDailyCapture'
import Companion from './pages/Companion'
import Community from './pages/Community'
import Insights from './pages/Insights'
import Timeline from './pages/Timeline'
import Record from './pages/Record'
import Memory from './pages/Memory'
import CareCircle from './pages/CareCircle'
import Login from './pages/Login'

type CaregiverLink = {
  person_id: string
  caregiver_id: string
  account_id: string
  permissions: string[]
}

function RequireAuth() {
  const [status, setStatus] = useState<'checking' | 'authenticated' | 'unauthenticated' | 'error'>(
    () => getAccessToken() && getPersonId() && getCaregiverId() ? 'checking' : 'unauthenticated',
  )
  const [error, setError] = useState('Could not verify your session.')
  const [retry, setRetry] = useState(0)

  const verifySession = useCallback(async () => {
    const token = getAccessToken()
    const personId = getPersonId()
    const caregiverId = getCaregiverId()
    if (!token || !personId || !caregiverId) {
      setStatus('unauthenticated')
      return
    }

    setStatus('checking')
    setError('')
    try {
      await getJSON('/auth/me')
      const links = await getJSON(
        `/auth/my-caregiver-links?person_id=${encodeURIComponent(personId)}`,
      ) as CaregiverLink[]
      if (!links.some(link => link.person_id === personId && link.caregiver_id === caregiverId)) {
        clearAccessToken()
        clearCareContext()
        setStatus('unauthenticated')
        return
      }
      setStatus('authenticated')
    } catch (cause) {
      if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) {
        clearAccessToken()
        clearCareContext()
        setStatus('unauthenticated')
        return
      }
      setError(cause instanceof Error ? cause.message : 'Could not verify your session.')
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    void verifySession()
    const refresh = () => void verifySession()
    window.addEventListener('solenos:auth-expired', refresh)
    window.addEventListener('solenos:auth-changed', refresh)
    window.addEventListener('personIdChanged', refresh)
    return () => {
      window.removeEventListener('solenos:auth-expired', refresh)
      window.removeEventListener('solenos:auth-changed', refresh)
      window.removeEventListener('personIdChanged', refresh)
    }
  }, [verifySession, retry])

  if (status === 'checking') {
    return <main role="status" style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-secondary)' }}>Verifying your session…</main>
  }
  if (status === 'error') {
    return (
      <main style={{ padding: '48px 24px', textAlign: 'center' }}>
        <p role="alert" style={{ color: 'var(--error)' }}>{error}</p>
        <button type="button" onClick={() => setRetry(value => value + 1)}>Retry session check</button>
      </main>
    )
  }
  return status === 'authenticated' ? <Outlet /> : <Navigate to="/login" replace />
}

function SessionControls() {
  const navigate = useNavigate()
  const [visible, setVisible] = useState(() => Boolean(getAccessToken()))
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const onAuthChanged = () => setVisible(Boolean(getAccessToken()))
    window.addEventListener('solenos:auth-changed', onAuthChanged)
    return () => window.removeEventListener('solenos:auth-changed', onAuthChanged)
  }, [])

  const logout = async () => {
    setBusy(true)
    try {
      await postJSON('/auth/logout', {})
    } catch (error) {
      console.warn('Backend logout did not complete; clearing the local session anyway.', error)
    } finally {
      clearAccessToken()
      clearCareContext()
      setVisible(false)
      setBusy(false)
      navigate('/login', { replace: true })
    }
  }

  if (!visible) return null
  return (
    <button
      type="button"
      onClick={logout}
      disabled={busy}
      style={{
        position: 'fixed', top: '12px', right: '12px', zIndex: 1000,
        padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)',
        background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer',
      }}
    >
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  )
}

export default function App() {
  return (
    <div className="app-container">
      <SessionControls />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/daily-care" element={<DailyCare />} />
          <Route path="/structured-daily-capture" element={<StructuredDailyCapture />} />
          <Route path="/timeline" element={<Timeline />} />
          <Route path="/record" element={<Record />} />
          <Route path="/memory" element={<Memory />} />
          <Route path="/care-circle" element={<CareCircle />} />
          <Route path="/companion" element={<Companion />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/community" element={<Community />} />
          <Route path="/professional" element={<Navigate to="/" replace />} />
          <Route path="/team" element={<Navigate to="/" replace />} />
          <Route path="/investor/dashboard" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </div>
  )
}
