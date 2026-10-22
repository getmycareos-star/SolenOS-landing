export default function Community() {
  return (
    <main style={{ maxWidth: '760px', margin: '0 auto', padding: '32px 20px', color: 'var(--text)' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 700, marginTop: '0' }}>Community</h1>
      <p role="status" style={{ marginTop: '16px', padding: '16px', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        Community is unavailable in this deployment because the real post, reaction, and moderation endpoints have not been verified. No example caregiver posts, invented author identities, reaction counts, or simulated matches are displayed. Your care record is separate and is not affected by this unavailable feature.
      </p>
    </main>
  )
}
