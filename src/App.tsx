import { useEffect, useState } from 'react'
import { Navigate, Outlet, Routes, Route, useNavigate } from 'react-router-dom'
import { clearAccessToken, clearCareContext, getAccessToken, getCaregiverId, getPersonId, postJSON } from './api/client'
import Dashboard from './vite-pages/Dashboard'
import DailyCare from './vite-pages/DailyCare'
import StructuredDailyCapture from './vite-pages/StructuredDailyCapture'
import Companion from './vite-pages/Companion'
import Community from './vite-pages/Community'
import ProfessionalDashboard from './vite-pages/ProfessionalDashboard'
import TeamDashboard from './vite-pages/TeamDashboard'
import Insights from './vite-pages/Insights'
import Timeline from './vite-pages/Timeline'
import Record from './vite-pages/Record'
import Memory from './vite-pages/Memory'
import CareCircle from './vite-pages/CareCircle'
import Login from './vite-pages/Login'
import InvestorDashboard from './vite-pages/InvestorDashboard'

function RequireAuth() {
  const [authenticated, setAuthenticated] = useState(() => Boolean(getAccessToken() && getPersonId() && getCaregiverId()))
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
    const onExpired = () => setVisible(false)
    const onAuthChanged = () => setVisible(Boolean(getAccessToken()))
    window.addEventListener('solenos:auth-expired', onExpired)
    window.addEventListener('solenos:auth-changed', onAuthChanged)
    return () => {
      window.removeEventListener('solenos:auth-expired', onExpired)
      window.removeEventListener('solenos:auth-changed', onAuthChanged)
    }
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
    <button type="button" onClick={logout} disabled={busy}
      style={{ position: 'fixed', top: '12px', right: '12px', zIndex: 1000, padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }}>
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
          <Route path="/professional" element={<ProfessionalDashboard />} />
          <Route path="/team" element={<TeamDashboard />} />
          <Route path="/investor/dashboard" element={<InvestorDashboard />} />
        </Route>
       </Routes>
    </div>
  )
}
