type Props = {
  role: string;
};

export default function RestrictedRolePage({ role }: Props) {
  return (
    <main style={{ padding: 24, maxWidth: 600, margin: '0 auto' }}>
      <h1>{role} access is not available yet</h1>
      <p role="alert">
        SolenOS has not verified a server-issued identity and permissions for this role.
        This route is blocked rather than showing an unverified or demo dashboard.
      </p>
      <p>Caregiver access remains available through the private anonymous care session.</p>
      <a href="/" style={{ color: 'var(--trust)' }}>Return to caregiver workspace</a>
    </main>
  );
}
