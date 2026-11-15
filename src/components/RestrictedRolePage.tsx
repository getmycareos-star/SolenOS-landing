type Props = {
  role: string;
};

export default function RestrictedRolePage({ role }: Props) {
  return (
    <main style={{ padding: 24, maxWidth: 600, margin: '0 auto' }}>
      <h1>{role} access is not available yet</h1>
      <p role="alert">
        We can't open this area because access has not been confirmed yet.
        Your care information is protected.
      </p>
      <p>You can still use your Care Record.</p>
      <a href="/workspace" style={{ color: 'var(--trust)' }}>Return to your Care Record</a>
    </main>
  );
}
