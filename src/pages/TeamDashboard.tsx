export default function TeamDashboard() {
  // This route has no verified team-session integration or server-enforced
  // team authorization in the current frontend contract. Do not fetch or
  // display caregiver monitoring, moderation, or aggregate care metrics until
  // those access controls exist.
  return (
    <main style={{ padding: '24px 32px', maxWidth: '760px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '12px' }}>
        Team dashboard unavailable
      </h1>
      <p role="alert" style={{ color: 'var(--error)', fontSize: '14px', lineHeight: 1.6 }}>
        Caregiver monitoring, moderation queues, and aggregate reports are hidden because this session cannot be verified as an authorized SolenOS team member.
      </p>
      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.6, marginTop: '12px' }}>
        No caregiver records, risk signals, moderation items, or metrics have been loaded. This page can be enabled only after server-side authentication and role-based authorization are implemented and verified.
      </p>
    </main>
  )
}
