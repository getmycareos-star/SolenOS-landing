import { Link } from 'react-router-dom'

export default function Companion() {
  return (
    <main style={{ maxWidth: '760px', margin: '0 auto', padding: '32px 20px', color: 'var(--text)' }}>
      <Link to="/" style={{ color: 'var(--trust)' }}>← Back to dashboard</Link>
      <h1 style={{ fontSize: '24px', fontWeight: 700, marginTop: '24px' }}>AI Companion</h1>
      <section
        role="status"
        style={{
          marginTop: '16px',
          padding: '20px',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          background: 'var(--surface)',
        }}
      >
        <h2 style={{ fontSize: '16px', fontWeight: 650, marginBottom: '8px' }}>
          Not available in this deployment
        </h2>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          The backend does not currently expose the conversation endpoint this feature requires.
          SolenOS will not simulate a response or present unverified text as evidence-grounded care guidance.
        </p>
      </section>
    </main>
  )
}
