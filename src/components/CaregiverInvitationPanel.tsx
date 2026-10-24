import { useEffect, useState } from 'react';
import { getJSON } from '../api/client';

type Caregiver = { id: string; name: string; relationship?: string };
type AccountSession = { access_token: string; account?: { email?: string; display_name?: string } };

async function accountRequest<T>(path: string, token: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const detail = result && typeof result.detail === 'string' ? result.detail : 'The account request could not be completed.';
    throw new Error(detail);
  }
  return result as T;
}

export default function CaregiverInvitationPanel({ personId }: { personId: string }) {
  const [caregivers, setCaregivers] = useState<Caregiver[]>([]);
  const [selectedCaregiver, setSelectedCaregiver] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accountToken, setAccountToken] = useState('');
  const [accountLabel, setAccountLabel] = useState('');
  const [permissions, setPermissions] = useState<Array<'read' | 'write'>>(['read', 'write']);
  const [acceptToken, setAcceptToken] = useState('');
  const [createdToken, setCreatedToken] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getJSON(`/caregivers/${encodeURIComponent(personId)}`)
      .then((data) => {
        if (!active) return;
        if (!Array.isArray(data)) throw new Error('The caregiver list response was incomplete.');
        setCaregivers(data as Caregiver[]);
      })
      .catch(() => {
        if (active) setCaregivers([]);
      });
    return () => { active = false; };
  }, [personId]);

  const signIn = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result || typeof result.access_token !== 'string') {
        throw new Error(result && typeof result.detail === 'string' ? result.detail : 'Account sign-in failed.');
      }
      setAccountToken(result.access_token);
      setAccountLabel(result.account?.display_name || result.account?.email || email.trim());
      setPassword('');
      setNotice('Signed in for this page session. Account credentials are not stored by this panel.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Account sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  const createInvitation = async () => {
    if (!accountToken || !selectedCaregiver || permissions.length === 0) {
      setError('Sign in, choose a caregiver, and select at least one permission.');
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    setCreatedToken('');
    try {
      const result = await accountRequest<{ invitation_token: string; expires_at: string }>(
        '/auth/caregiver-invitations',
        accountToken,
        { person_id: personId, caregiver_id: selectedCaregiver, permissions },
      );
      setCreatedToken(result.invitation_token);
      setExpiresAt(result.expires_at);
      setNotice('Invitation token created by the backend. It has not been emailed or delivered automatically; share it securely with the intended caregiver.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Invitation could not be created.');
    } finally {
      setBusy(false);
    }
  };

  const acceptInvitation = async () => {
    if (!accountToken || !acceptToken.trim()) {
      setError('Sign in to the intended caregiver account and enter the invitation token.');
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await accountRequest('/auth/caregiver-invitations/accept', accountToken, { token: acceptToken.trim() });
      setAcceptToken('');
      setNotice('Invitation accepted. The backend confirmed the caregiver-account link and permissions.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Invitation could not be accepted.');
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    const token = accountToken;
    setBusy(true);
    setError(null);
    try {
      await accountRequest('/auth/logout', token, {});
    } catch {
      // Always clear this component's in-memory token; server expiry/revocation is reported only when confirmed.
    } finally {
      setAccountToken('');
      setAccountLabel('');
      setCreatedToken('');
      setExpiresAt('');
      setBusy(false);
      setNotice('Account token cleared from this page session.');
    }
  };

  const fieldStyle = { display: 'block', width: '100%', boxSizing: 'border-box' as const, padding: '9px 10px', marginTop: '5px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg)', color: 'var(--text)', font: 'inherit' };

  return (
    <section aria-labelledby="caregiver-invitations-heading" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 20px', marginBottom: '24px' }}>
      <h2 id="caregiver-invitations-heading" style={{ fontSize: '18px', fontWeight: 600, marginBottom: '6px' }}>Caregiver access</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '14px' }}>
        Invitations require an authenticated account with owner/admin permission for this exact care record. Tokens are single-use and expire; creating one does not send an email.
      </p>
      {error && <p role="alert" style={{ color: 'var(--unknown)', fontSize: '13px', marginBottom: '10px' }}>{error}</p>}
      {notice && <p role="status" style={{ color: 'var(--trust)', fontSize: '13px', marginBottom: '10px' }}>{notice}</p>}
      {!accountToken ? (
        <form onSubmit={event => { event.preventDefault(); void signIn(); }} style={{ display: 'grid', gap: '10px', maxWidth: '520px' }}>
          <label style={{ fontSize: '13px' }}>Account email
            <input type="email" required autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} style={fieldStyle} />
          </label>
          <label style={{ fontSize: '13px' }}>Password
            <input type="password" required autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} style={fieldStyle} />
          </label>
          <button type="submit" disabled={busy} style={{ justifySelf: 'start', padding: '9px 14px', border: 0, borderRadius: '6px', background: 'var(--trust)', color: '#fff' }}>{busy ? 'Signing in…' : 'Sign in for caregiver access'}</button>
        </form>
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Account session: {accountLabel || 'Authenticated account'} · held in memory for this page only.</p>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
            <h3 style={{ fontSize: '14px', marginBottom: '8px' }}>Create caregiver invitation</h3>
            <label style={{ fontSize: '13px' }}>Existing caregiver identity
              <select value={selectedCaregiver} onChange={event => setSelectedCaregiver(event.target.value)} style={fieldStyle} required>
                <option value="">Choose a caregiver identity</option>
                {caregivers.map(item => <option key={item.id} value={item.id}>{item.name}{item.relationship ? ` · ${item.relationship}` : ''}</option>)}
              </select>
            </label>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', margin: '10px 0' }}>
              {(['read', 'write'] as const).map(permission => <label key={permission} style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input type="checkbox" checked={permissions.includes(permission)} onChange={event => setPermissions(current => event.target.checked ? [...current, permission] : current.filter(value => value !== permission))} /> {permission === 'read' ? 'Read care record' : 'Write care updates'}
              </label>)}
            </div>
            <button type="button" disabled={busy || !selectedCaregiver || permissions.length === 0} onClick={() => void createInvitation()} style={{ padding: '9px 14px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg)', color: 'var(--text)' }}>{busy ? 'Working…' : 'Create single-use invitation'}</button>
            {createdToken && <div style={{ marginTop: '10px', padding: '10px', border: '1px solid var(--border)', borderRadius: '6px' }}>
              <strong style={{ fontSize: '12px' }}>Invitation token — share securely</strong>
              <textarea aria-label="Invitation token" readOnly rows={3} value={createdToken} style={fieldStyle} onFocus={event => event.currentTarget.select()} />
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '5px' }}>Expires: {expiresAt ? new Date(expiresAt).toLocaleString() : 'Expiry not returned'}.</p>
            </div>}
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
            <h3 style={{ fontSize: '14px', marginBottom: '8px' }}>Accept an invitation</h3>
            <label style={{ fontSize: '13px' }}>Single-use invitation token
              <textarea rows={2} value={acceptToken} onChange={event => setAcceptToken(event.target.value)} style={fieldStyle} placeholder="Paste the invitation token received from the care-record owner" />
            </label>
            <button type="button" disabled={busy || !acceptToken.trim()} onClick={() => void acceptInvitation()} style={{ marginTop: '8px', padding: '9px 14px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg)', color: 'var(--text)' }}>Accept invitation</button>
          </div>
          <button type="button" disabled={busy} onClick={() => void signOut()} style={{ justifySelf: 'start', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px', background: 'transparent', color: 'var(--text)' }}>Clear account session</button>
        </div>
      )}
    </section>
  );
}
