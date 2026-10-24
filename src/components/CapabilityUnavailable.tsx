import { Link } from 'react-router-dom';

export default function CapabilityUnavailable() {
  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '28px 20px' }}>
      <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em' }}>SOLENOS CAPABILITY STATUS</p>
      <h1 style={{ fontSize: '26px', margin: '8px 0 12px' }}>Care Circle is not available yet</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6 }}>
        The current frontend contains a Care Circle screen, but the inspected backend does not expose the matching care-circle API routes. SolenOS will not pretend that care coordination can be saved or retrieved through this screen.
      </p>
      <p style={{ fontSize: '14px', lineHeight: 1.6 }}>
        You can still preserve care information in the Living Care Record or explore peer experiences in Community.
      </p>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '18px' }}>
        <Link to="/record" style={{ background: 'var(--trust)', color: 'white', padding: '10px 14px', borderRadius: '8px', textDecoration: 'none', fontSize: '13px' }}>Open Living Care Record</Link>
        <Link to="/community" style={{ border: '1px solid var(--border)', color: 'var(--text)', padding: '10px 14px', borderRadius: '8px', textDecoration: 'none', fontSize: '13px' }}>Open Community</Link>
      </div>
    </main>
  );
}
