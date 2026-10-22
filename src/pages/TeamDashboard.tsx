export default function TeamDashboard() {
  return (
    <main
      style={{
        maxWidth: '760px',
        margin: '0 auto',
        padding: '48px 24px',
        color: 'var(--text)',
      }}
    >
      <h1 style={{ fontSize: '24px', fontWeight: 650, marginBottom: '12px' }}>
        Team operations are not enabled
      </h1>
      <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        Caregiver monitoring, community moderation, aggregate reports, and system
        metrics are unavailable in this deployment because their production
        backend endpoints and staff authorization are not implemented and verified.
      </p>
      <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        No sample caregiver profiles, invented community posts, or simulated
        metrics are displayed. This page will remain unavailable until real data
        access and staff-only authorization are verified end to end.
      </p>
    </main>
  )
}
