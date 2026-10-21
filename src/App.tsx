import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { checkAuthState, AuthSessionInfo } from './api/client'
import Dashboard from './pages/Dashboard'
import DailyCare from './pages/DailyCare'
import StructuredDailyCapture from './pages/StructuredDailyCapture'
import Companion from './pages/Companion'
import Community from './pages/Community'
import ProfessionalDashboard from './pages/ProfessionalDashboard'
import TeamDashboard from './pages/TeamDashboard'
import Insights from './pages/Insights'
import Timeline from './pages/Timeline'
import Record from './pages/Record'
import Memory from './pages/Memory'
import CareCircle from './pages/CareCircle'
import Appointments from './pages/Appointments'
import Login from './pages/Login'
import InvestorDashboard from './pages/InvestorDashboard'

function AuthGate({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const [status, setStatus] = useState<'checking' | 'authenticated' | 'denied'>('checking')
  const [session, setSession] = useState<AuthSessionInfo | null>(null)
  const location = useLocation()

  useEffect(() => {
    let active = true
    void checkAuthState().then(result => {
      if (!active) return
      setSession(result.sessionInfo)
      setStatus(result.authenticated ? 'authenticated' : 'denied')
    })
    return () => { active = false }
  }, [location.pathname])

  if (status === 'checking') {
    return <main role="status" style={{ padding: 32, color: 'var(--text-secondary)' }}>Verifying secure session…</main>
  }
  if (status === 'denied') return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (roles && (!session?.role || !roles.includes(session.role))) {
    return <main role="alert" style={{ padding: 32 }}>Your authenticated account does not have permission to access this workspace.</main>
  }
  return <>{children}</>
}

export default function App() {
  return (
    <div className="app-container">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<AuthGate><Dashboard /></AuthGate>} />
        <Route path="/daily-care" element={<AuthGate><DailyCare /></AuthGate>} />
        <Route path="/structured-daily-capture" element={<AuthGate><StructuredDailyCapture /></AuthGate>} />
        <Route path="/timeline" element={<AuthGate><Timeline /></AuthGate>} />
        <Route path="/record" element={<AuthGate><Record /></AuthGate>} />
        <Route path="/memory" element={<AuthGate><Memory /></AuthGate>} />
        <Route path="/care-circle" element={<AuthGate><CareCircle /></AuthGate>} />
        <Route path="/appointments" element={<AuthGate><Appointments /></AuthGate>} />
        <Route path="/companion" element={<AuthGate><Companion /></AuthGate>} />
        <Route path="/insights" element={<AuthGate><Insights /></AuthGate>} />
        <Route path="/community" element={<AuthGate><Community /></AuthGate>} />
        <Route path="/professional" element={<AuthGate roles={['professional']}><ProfessionalDashboard /></AuthGate>} />
        <Route path="/team" element={<AuthGate roles={['team']}><TeamDashboard /></AuthGate>} />
        <Route path="/investor/dashboard" element={<AuthGate roles={['team']}><InvestorDashboard /></AuthGate>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
