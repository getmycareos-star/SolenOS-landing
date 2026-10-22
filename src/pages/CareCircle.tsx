export default function CareCircle() {
  return (
    <main style={{ padding: '24px 32px', maxWidth: '760px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '12px' }}>
        Care Circle unavailable
      </h1>
      <p role="alert" style={{ color: 'var(--error)', fontSize: '14px', lineHeight: 1.6 }}>
        Care-circle membership and invitation changes are unavailable because the required backend routes and authorization checks have not been verified.
      </p>
      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.6, marginTop: '12px' }}>
        No member list is being represented as empty, and no invitation or membership action is offered until the server can read and write real, authorized records.
      </p>
    </main>
  )
}
