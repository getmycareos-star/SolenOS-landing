import { Link } from 'react-router-dom'

export default function Login() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
      }}
    >
      <section
        aria-labelledby="login-title"
        style={{ maxWidth: 520, width: '100%', padding: '32px 24px' }}
      >
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <span aria-hidden="true" style={{ fontSize: 44, display: 'block' }}>🏠</span>
          <h1 id="login-title" style={{ fontSize: 22, color: 'var(--text)' }}>
            Open your Living Care Record
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Family caregivers can start without creating an account. SolenOS opens a
            private anonymous care session and keeps the care record scoped to that session.
          </p>
        </div>

        <Link
          to="/"
          style={{
            display: 'block',
            textAlign: 'center',
            padding: '13px 18px',
            borderRadius: 12,
            background: 'var(--trust)',
            color: 'white',
            textDecoration: 'none',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Continue as caregiver
        </Link>

        <section
          aria-labelledby="restricted-access-title"
          style={{
            marginTop: 24,
            padding: 16,
            border: '1px solid var(--border)',
            borderRadius: 12,
            background: 'var(--surface)',
          }}
        >
          <h2 id="restricted-access-title" style={{ fontSize: 15, color: 'var(--text)' }}>
            Professional and SolenOS team access
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            These access paths are unavailable until server-side account authentication,
            role verification, and care-context permissions are deployed. Selecting a role,
            entering an ID, or setting a browser preference is not authentication.
          </p>
        </section>
      </section>
    </main>
  )
}
