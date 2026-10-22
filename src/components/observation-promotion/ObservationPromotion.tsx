export default function ObservationPromotion() {
  return (
    <section role="status" aria-live="polite" style={{ marginBottom: '24px' }}>
      <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px' }}>
        Observation review
      </h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
        Observation promotion is unavailable because the production data source and server-side attribution have not been verified. No example observations or generated perspectives are shown.
      </p>
    </section>
  )
}
