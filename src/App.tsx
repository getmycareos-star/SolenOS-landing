import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, Routes, Route, Link, useNavigate } from 'react-router-dom'
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
import { isAuthenticated, logout } from './api/client'

function RequireAuth({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(isAuthenticated)
  const navigate = useNavigate()

  useEffect(() => {
    const update = () => setAuthenticated(isAuthenticated())
    window.addEventListener('authChanged', update)
    return () => window.removeEventListener('authChanged', update)
  }, [])

  if (!authenticated) return <Navigate to="/login" replace />

  const handleLogout = async () => {
    try {
      await logout()
    } finally {
      navigate('/login', { replace: true })
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleLogout}
        aria-label="Sign out of SolenOS"
        style={{
          position: 'fixed',
          top: '12px',
          right: '12px',
          zIndex: 10000,
          border: '1px solid var(--border)',
          borderRadius: '8px',
          padding: '8px 12px',
          background: 'var(--surface)',
          color: 'var(--text)',
          fontSize: '12px',
          cursor: 'pointer',
        }}
      >
        Sign out
      </button>
      {children}
    </>
  )
}

function UnavailableRolePage() {
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '24px', background: 'var(--bg)', color: 'var(--text)' }}>
      <section style={{ maxWidth: '440px', textAlign: 'center' }}>
        <h1>Access not enabled</h1>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Professional, team, and investor access require separate verified roles and permissions. Those roles are not enabled by the current authentication backend.
        </p>
        <Link to="/login" style={{ color: 'var(--trust)' }}>Return to caregiver sign-in</Link>
      </section>
    </main>
  )
}

export default function App() {
  return (
    <div className="app-container">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/professional" element={<UnavailableRolePage />} />
        <Route path="/team" element={<UnavailableRolePage />} />
        <Route path="/investor/dashboard" element={<UnavailableRolePage />} />
        <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/daily-care" element={<RequireAuth><DailyCare /></RequireAuth>} />
        <Route path="/structured-daily-capture" element={<RequireAuth><StructuredDailyCapture /></RequireAuth>} />
        <Route path="/timeline" element={<RequireAuth><Timeline /></RequireAuth>} />
        <Route path="/record" element={<RequireAuth><Record /></RequireAuth>} />
        <Route path="/memory" element={<RequireAuth><Memory /></RequireAuth>} />
        <Route path="/care-circle" element={<RequireAuth><CareCircle /></RequireAuth>} />
        <Route path="/companion" element={<RequireAuth><Companion /></RequireAuth>} />
        <Route path="/insights" element={<RequireAuth><Insights /></RequireAuth>} />
        <Route path="/community" element={<RequireAuth><Community /></RequireAuth>} />
      </Routes>
    </div>
  )
}
