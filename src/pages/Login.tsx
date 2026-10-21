import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getJSON, postJSON, setPersonId } from '../api/client';

type CareContext = {
  person_id: string;
  name: string;
  role: string;
  permissions: string[];
};

type AuthResponse = {
  access_token: string;
  token_type: string;
  account: { id: string; email: string; display_name?: string | null };
};

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [careRecipientName, setCareRecipientName] = useState('');
  const [contexts, setContexts] = useState<CareContext[]>([]);
  const [needsCareRecord, setNeedsCareRecord] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const enterContext = (context: CareContext) => {
    setPersonId(context.person_id);
    navigate('/');
  };

  const createCareRecord = async () => {
    if (!careRecipientName.trim()) {
      setError('Enter the name of the person whose care you are recording.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const context = await postJSON('/auth/care-contexts', { name: careRecipientName.trim() }) as CareContext;
      const caregiverName = displayName.trim() || email.trim().split('@')[0];
      const caregiver = await postJSON('/caregivers', {
        person_id: context.person_id,
        name: caregiverName,
        email: email.trim().toLowerCase(),
        relationship: 'caregiver',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      }) as { id: string };
      const invitation = await postJSON('/auth/caregiver-invitations', {
        person_id: context.person_id,
        caregiver_id: caregiver.id,
        permissions: ['read', 'write'],
      }) as { invitation_token: string };
      await postJSON('/auth/caregiver-invitations/accept', { token: invitation.invitation_token });
      enterContext(context);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the care record. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setContexts([]);
    setNeedsCareRecord(false);
    try {
      if (mode === 'signup') {
        if (!careRecipientName.trim()) {
          setError('Enter the name of the person whose care you are recording.');
          return;
        }
        await postJSON('/auth/signup', {
          email: email.trim().toLowerCase(),
          password,
          display_name: displayName.trim() || null,
        });
      }

      const auth = await postJSON('/auth/login', {
        email: email.trim().toLowerCase(),
        password,
      }) as AuthResponse;
      if (!auth.access_token) throw new Error('The server did not return a valid session.');
      sessionStorage.setItem('solenos_access_token', auth.access_token);
      if (auth.account?.display_name) setDisplayName(auth.account.display_name);

      if (mode === 'signup') {
        await createCareRecord();
        return;
      }

      const linkedContexts = await getJSON('/auth/care-contexts') as CareContext[];
      if (!Array.isArray(linkedContexts) || linkedContexts.length === 0) {
        setNeedsCareRecord(true);
        return;
      }
      if (linkedContexts.length === 1) {
        enterContext(linkedContexts[0]);
        return;
      }
      setContexts(linkedContexts);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Authentication failed. Check your details and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '24px' }}>
      <section style={{ maxWidth: 480, width: '100%', padding: 24, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <span style={{ fontSize: 42, display: 'block' }} aria-hidden="true">🏠</span>
          <h1 style={{ fontSize: 22, fontWeight: 650, color: 'var(--text)' }}>SolenOS</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Your Living Care Record</p>
        </div>

        {contexts.length > 0 ? (
          <>
            <h2 style={{ fontSize: 16 }}>Choose a care record</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Select the person whose record you need. Access is limited to records linked to your account.</p>
            {contexts.map((context) => (
              <button key={context.person_id} type="button" onClick={() => enterContext(context)} style={{ width: '100%', padding: 14, marginTop: 8, textAlign: 'left', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer' }}>
                <strong>{context.name}</strong>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{context.role}</span>
              </button>
            ))}
          </>
        ) : needsCareRecord ? (
          <>
            <h2 style={{ fontSize: 17 }}>Create a care record</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Your account is authenticated but is not linked to a care record yet.</p>
            <label style={{ display: 'block', fontSize: 13, margin: '16px 0 6px' }} htmlFor="care-recipient-name">Name of the person receiving care</label>
            <input id="care-recipient-name" value={careRecipientName} onChange={(e) => setCareRecipientName(e.target.value)} required style={{ width: '100%', padding: 12, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)' }} />
            <button type="button" disabled={busy} onClick={createCareRecord} style={{ width: '100%', padding: 12, marginTop: 16, border: 0, borderRadius: 8, background: 'var(--trust)', color: '#fff', cursor: busy ? 'wait' : 'pointer' }}>{busy ? 'Creating record…' : 'Create care record'}</button>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <button type="button" onClick={() => { setMode('login'); setError(''); }} aria-pressed={mode === 'login'} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: mode === 'login' ? 'var(--accent-soft)' : 'var(--bg)' }}>Sign in</button>
              <button type="button" onClick={() => { setMode('signup'); setError(''); }} aria-pressed={mode === 'signup'} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: mode === 'signup' ? 'var(--accent-soft)' : 'var(--bg)' }}>Create account</button>
            </div>
            <form onSubmit={handleSubmit}>
              {mode === 'signup' && (
                <>
                  <label htmlFor="display-name" style={{ display: 'block', fontSize: 13, margin: '12px 0 6px' }}>Your name</label>
                  <input id="display-name" autoComplete="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={{ width: '100%', padding: 12, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)' }} />
                  <label htmlFor="care-recipient-name" style={{ display: 'block', fontSize: 13, margin: '12px 0 6px' }}>Name of the person receiving care</label>
                  <input id="care-recipient-name" value={careRecipientName} onChange={(e) => setCareRecipientName(e.target.value)} required style={{ width: '100%', padding: 12, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)' }} />
                </>
              )}
              <label htmlFor="email" style={{ display: 'block', fontSize: 13, margin: '12px 0 6px' }}>Email</label>
              <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%', padding: 12, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)' }} />
              <label htmlFor="password" style={{ display: 'block', fontSize: 13, margin: '12px 0 6px' }}>Password</label>
              <input id="password" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={mode === 'signup' ? 12 : 1} value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: '100%', padding: 12, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)' }} />
              {mode === 'signup' && <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>Use at least 12 characters.</p>}
              <button type="submit" disabled={busy} style={{ width: '100%', padding: 12, marginTop: 18, border: 0, borderRadius: 8, background: 'var(--trust)', color: '#fff', cursor: busy ? 'wait' : 'pointer' }}>{busy ? 'Please wait…' : mode === 'signup' ? 'Create account and care record' : 'Sign in'}</button>
            </form>
          </>
        )}

        {error && <p role="alert" style={{ color: 'var(--error)', fontSize: 13, marginTop: 16 }}>{error}</p>}
        <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 20 }}>SolenOS requires an authenticated account and explicit access to each care record. A role selection or local identifier alone does not grant access.</p>
      </section>
    </main>
  );
}
