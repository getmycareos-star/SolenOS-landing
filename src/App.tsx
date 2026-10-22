import { useEffect, useState, type ReactNode } from 'react'
import { Routes, Route } from 'react-router-dom'
import { ensureAnonymousSession } from './api/client'
import RestrictedRolePage from './components/RestrictedRolePage'
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

function AnonymousSessionGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');

  async function initializeSession() {
    setStatus('loading');
    setError('');
    try {
      await ensureAnonymousSession();
      setStatus('ready');
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'SolenOS could not establish a secure anonymous care session.',
      );
      setStatus('error');
    }
  }

  useEffect(() => {
    void initializeSession();
    // Initialize once on app mount. Retry is an explicit user action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === 'loading') {
    return <main role="status" aria-live="polite" style={{ padding: 24 }}>Preparing your private care record…</main>;
  }

  if (status === 'error') {
    const recoveryUnavailable = /no session credential|session has expired/i.test(error);
    return (
      <main style={{ padding: 24, maxWidth: 560, margin: '0 auto' }}>
        <h1>Could not open your care record</h1>
        <p role="alert">{error}</p>
        <p>If this browser already held care notes, keep its storage intact while access is recovered. SolenOS will not silently switch to a different care record.</p>
        {!recoveryUnavailable && <button type="button" onClick={() => void initializeSession()}>Retry</button>}
      </main>
    );
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <AnonymousSessionGate>
    <div className="app-container">
      <Routes>
        <Route path="/login" element={<Login />} />
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
        <Route path="/professional" element={<RestrictedRolePage role="Professional" />} />
        <Route path="/team" element={<RestrictedRolePage role="SolenOS team" />} />
        <Route path="/investor/dashboard" element={<RestrictedRolePage role="Investor dashboard" />} />
       </Routes>
    </div>
    </AnonymousSessionGate>
  )
}
