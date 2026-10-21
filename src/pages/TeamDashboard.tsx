import React from 'react'

/**
 * This dashboard previously called /team/dashboard, /team/state-report,
 * /metrics, and Community moderation routes. None are implemented by the
 * deployed FastAPI router. Do not fabricate zero-valued analytics or imply
 * moderation actions are available until those contracts exist.
 */
export default function TeamDashboard() {
  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '32px 24px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 600 }}>SolenOS Team Dashboard</h1>
      <section role="status" style={{ marginTop: 20, padding: 20, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)' }}>
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>Not available yet</h2>
        <p style={{ marginTop: 8, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
          Team analytics, moderation queues, state reports, and service metrics are not exposed by the current backend API. This page is intentionally disabled; no sample caregiver-risk records, metrics, or moderation results are shown.
        </p>
      </section>
    </main>
  )
}
