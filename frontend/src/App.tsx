import { Routes, Route, Link, useLocation } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Timeline from './pages/Timeline'
import Insights from './pages/Insights'
import Record from './pages/Record'
import Memory from './pages/Memory'

const navItems = [
  { path: '/', label: 'Today' },
  { path: '/timeline', label: 'Timeline' },
  { path: '/insights', label: 'Insights' },
  { path: '/record', label: 'Record' },
  { path: '/memory', label: 'Memory' },
]

export default function App() {
  const location = useLocation()
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <Link to="/" style={{ textDecoration: 'none', color: 'var(--text)', fontSize: '18px', fontWeight: 600, letterSpacing: '-0.02em' }}>
          SolenOS
        </Link>
        <nav style={{ display: 'flex', gap: '24px' }}>
          {navItems.map(item => (
            <Link key={item.path} to={item.path} style={{
              textDecoration: 'none', color: location.pathname === item.path ? 'var(--text)' : 'var(--text-secondary)',
              fontSize: '14px', fontWeight: location.pathname === item.path ? 500 : 400
            }}>
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main style={{ flex: 1, maxWidth: '800px', width: '100%', margin: '0 auto', padding: '32px 24px' }}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/timeline" element={<Timeline />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/record" element={<Record />} />
          <Route path="/memory" element={<Memory />} />
        </Routes>
      </main>
    </div>
  )
}
