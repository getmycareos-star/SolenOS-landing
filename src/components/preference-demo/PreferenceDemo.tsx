export default function PreferenceDemo() {
  return (
    <section role="status" aria-live="polite">
      <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px' }}>
        Preference management
      </h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
        Preference management is unavailable until real account-scoped persistence is implemented and verified. No simulated settings or placeholder user identities are displayed.
      </p>
    </section>
  )
}
