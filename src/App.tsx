import { useEffect, useState, type ReactNode } from 'react'
import { Routes, Route } from 'react-router-dom'
import { ensureAnonymousSession } from './api/client'
import RestrictedRolePage from './components/RestrictedRolePage'
import FirstUseJourney from './components/FirstUseJourney'
import Dashboard from './pages/Dashboard'
import DailyCare from './pages/DailyCare'
import StructuredDailyCapture from './pages/StructuredDailyCapture'
import Companion from './pages/Companion'
import Community from './pages/Community'
import Insights from './pages/Insights'
import Timeline from './pages/Timeline'
import Record from './pages/Record'
import Memory from './pages/Memory'
import CapabilityUnavailable from './components/CapabilityUnavailable'
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
    const startingPoints = [
      { title: 'Daily Capture', detail: 'Record an observation or event in your own words.' },
      { title: 'AI Companion', detail: 'Ask a care-related question; conversation is not automatically saved as a care fact.' },
      { title: 'Documents and Living Care Record', detail: 'Add a supported text document or review the source evidence that builds continuity.' },
    ];
    return (
      <main aria-labelledby="session-start-title" style={{ padding: 'clamp(20px, 5vw, 36px)', maxWidth: 760, margin: '0 auto' }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--trust)' }}>SOLENOS · LIVING CARE RECORD</p>
        <h1 id="session-start-title" style={{ fontSize: 'clamp(26px, 5vw, 36px)', lineHeight: 1.15, margin: '10px 0 12px' }}>Keep the care story connected.</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.65, marginBottom: 20 }}>
          SolenOS helps family caregivers bring daily observations, questions, and supported care documents together over time—while keeping original reports distinct from AI interpretations and unconfirmed information.
        </p>
        <h2 style={{ fontSize: 14, marginBottom: 10 }}>Choose a starting point</h2>
        <div style={{ display: 'grid', gap: 8 }}>
          {startingPoints.map((item) => (
            <div key={item.title} aria-disabled="true" style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', opacity: 0.78 }}>
              <strong style={{ fontSize: 13 }}>{item.title}</strong>
              <p style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.5, marginTop: 4 }}>{item.detail}</p>
            </div>
          ))}
        </div>
        <p role="status" aria-live="polite" style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 18 }}>
          Preparing your private care record. Actions will be available once the server confirms this session.
        </p>
      </main>
    );
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
          <Route path="/" element={<FirstUseJourney />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/daily-care" element={<DailyCare />} />
          <Route path="/structured-daily-capture" element={<StructuredDailyCapture />} />
          <Route path="/timeline" element={<Timeline />} />
          <Route path="/record" element={<Record />} />
          <Route path="/memory" element={<Memory />} />
          <Route path="/care-circle" element={<CapabilityUnavailable />} />
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
