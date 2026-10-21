import { useEffect, useState } from 'react'
import { Navigate, Outlet, Routes, Route, useNavigate } from 'react-router-dom'
import {
  clearAccessToken,
  clearCareContext,
  getAccessToken,
  getCaregiverId,
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

function RequireAuth() {
  const [authenticated, setAuthenticated] = useState(
    () => Boolean(getAccessToken() && getPersonId() && getCaregiverId()),
  )

  useEffect(() => {
    const refresh = () => setAuthenticated(Boolean(getAccessToken() && getPersonId() && getCaregiverId()))
    window.addEventListener('solenos:auth-expired', refresh)
    window.addEventListener('solenos:auth-changed', refresh)
    window.addEventListener('personIdChanged', refresh)
    return () => {
      window.removeEventListener('solenos:auth-expired', refresh)
      window.removeEventListener('solenos:auth-changed', refresh)
      window.removeEventListener('personIdChanged', refresh)
    }
  }, [])

  return authenticated ? <Outlet /> : <Navigate to="/login" replace />
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
