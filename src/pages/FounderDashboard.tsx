export default function FounderDashboard() {
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
        Founder operations are not enabled
      </h1>
      <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        This dashboard is unavailable because SolenOS does not yet expose verified,
        authenticated founder reporting endpoints for these metrics.
      </p>
      <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        No estimated user counts, product-availability percentages, error rates,
        activation rates, or operational totals are displayed as if they were live
        measurements. The dashboard will remain unavailable until those metrics
        have a defined source, authorization policy, and verified production query.
      </p>
    </main>
  )
}
