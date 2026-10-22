export default function ProfessionalDashboard() {
  return (
    <main style={{ padding: '24px 32px', maxWidth: '760px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '12px' }}>
        Professional dashboard unavailable
      </h1>
      <p role="alert" style={{ color: 'var(--error)', fontSize: '14px', lineHeight: 1.6 }}>
        Patient summaries, alerts, and care metrics are hidden because this application cannot verify a professional identity or enforce patient-level authorization.
      </p>
      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.6, marginTop: '12px' }}>
        No multi-patient records have been requested or displayed. This view can be enabled only after server-side authentication, professional verification, and per-patient access controls are implemented and tested.
      </p>
    </main>
  )
}
