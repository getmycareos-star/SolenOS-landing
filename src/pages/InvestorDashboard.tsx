export default function InvestorDashboard() {
  return (
    <main style={{ padding: '24px 32px', maxWidth: '760px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '12px' }}>
        Investor metrics unavailable
      </h1>
      <p role="alert" style={{ color: 'var(--error)', fontSize: '14px', lineHeight: 1.6 }}>
        This application cannot verify an investor session or authorize access to internal metrics. No metrics have been requested or displayed.
      </p>
      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.6, marginTop: '12px' }}>
        This view remains disabled until server-side authentication and role-based authorization are available.
      </p>
    </main>
  )
}
