import { Link } from 'react-router-dom'

export default function Login() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'var(--bg)' }}>
      <section style={{ maxWidth: '560px', width: '100%', padding: '28px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 650, color: 'var(--text)', marginBottom: '12px' }}>
          Secure sign-in is not available yet
        </h1>
        <p role="alert" style={{ fontSize: '14px', lineHeight: 1.65, color: 'var(--error)', marginBottom: '12px' }}>
          This screen cannot verify a caregiver, healthcare professional, team member, or investor identity. Selecting a role or entering an identifier would not authenticate you.
        </p>
        <p style={{ fontSize: '13px', lineHeight: 1.65, color: 'var(--text-secondary)', marginBottom: '20px' }}>
          Protected professional, team, and investor views remain unavailable until server-side sign-in and role-based access checks are implemented and verified.
        </p>
        <Link to="/" style={{ color: 'var(--trust)', textDecoration: 'none', fontSize: '13px' }}>
          Return to caregiver workspace
        </Link>
      </section>
    </main>
  )
}
