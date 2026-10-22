import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getJSON, getPersonId } from '../api/client';

type RecordState = 'loading' | 'empty' | 'existing' | 'unknown';

const primaryActions = [
  {
    to: '/daily-care',
    eyebrow: '01 · CAPTURE',
    title: 'Record what happened',
    description: 'Save an observation, concern, or change in your own words. Keep the original report available for review.',
    action: 'Start Daily Capture',
  },
  {
    to: '/companion',
    eyebrow: '02 · UNDERSTAND',
    title: 'Ask AI Companion',
    description: 'Ask a care-related question. Responses are guidance, not automatically saved facts in the Living Care Record.',
    action: 'Open Companion',
  },
  {
    to: '/record',
    eyebrow: '03 · ADD CONTEXT',
    title: 'Add a care document',
    description: 'The current document intake reads text files (.txt, .md, .csv, .json, .log). PDF and scanned-image OCR are not available in this workflow yet.',
    action: 'Open documents and record',
  },
];

const secondaryAreas = [
  { to: '/dashboard', title: 'Dashboard overview', detail: 'Review existing events, available insights, and active actions.' },
  { to: '/record', title: 'Living Care Record', detail: 'Review saved evidence and the evolving care account.' },
  { to: '/community', title: 'Community', detail: 'Explore peer experiences separately from this person’s record.' },
  { to: '/timeline', title: 'Timeline', detail: 'Review recorded events in time order.' },
  { to: '/insights', title: 'Insights', detail: 'Review available derived observations with appropriate caution.' },
  { to: '/memory', title: 'Care memory', detail: 'Review available remembered care context.' },
];

export default function FirstUseJourney() {
  const [recordState, setRecordState] = useState<RecordState>('loading');
  const [retry, setRetry] = useState(0);
  const personId = getPersonId();

  useEffect(() => {
    let active = true;
    async function inspectRecord() {
      if (!personId) {
        setRecordState('unknown');
        return;
      }
      setRecordState('loading');
      const results = await Promise.allSettled([
        getJSON(`/events/${encodeURIComponent(personId)}?limit=1`),
        getJSON(`/evidence/${encodeURIComponent(personId)}`),
      ]);
      if (!active) return;
      const hasData = results.some((result) =>
        result.status === 'fulfilled' &&
        Array.isArray(result.value) &&
        result.value.length > 0
      );
      if (hasData) {
        setRecordState('existing');
        return;
      }
      const bothEmpty = results.every((result) =>
        result.status === 'fulfilled' &&
        Array.isArray(result.value) &&
        result.value.length === 0
      );
      setRecordState(bothEmpty ? 'empty' : 'unknown');
    }
    void inspectRecord().catch(() => {
      if (active) setRecordState('unknown');
    });
    return () => { active = false; };
  }, [personId, retry]);

  return (
    <section aria-labelledby="first-use-title" style={{
      border: '1px solid var(--border)',
      borderRadius: '18px',
      padding: 'clamp(18px, 3vw, 30px)',
      marginBottom: '28px',
      background: 'var(--surface)',
    }}>
      <div style={{ maxWidth: '760px' }}>
        <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', color: 'var(--trust)', marginBottom: '8px' }}>
          SOLENOS · LIVING CARE RECORD
        </p>
        <h1 id="first-use-title" style={{ fontSize: 'clamp(26px, 4vw, 36px)', lineHeight: 1.12, fontWeight: 700, margin: '0 0 12px' }}>
          Keep the care story connected.
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: 1.65, margin: '0 0 12px' }}>
          SolenOS helps family caregivers bring observations, events, and care documents together over time—so it is easier to review what was reported, what may have changed, what remains unclear, and what to ask next.
        </p>
        <p role="status" aria-live="polite" style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 22px' }}>
          {recordState === 'loading' && 'Checking the current care record…'}
          {recordState === 'empty' && 'This care record has no events or evidence yet. Start wherever it is easiest; you do not need to complete a profile first.'}
          {recordState === 'existing' && 'Saved care information was found. You can add to it or review the current record.'}
          {recordState === 'unknown' && 'The current record state could not be confirmed. You can still open a starting point; SolenOS will not assume the record is empty.'}
        </p>
        {recordState === 'unknown' && (
          <button type="button" onClick={() => setRetry((value) => value + 1)} style={{
            border: '1px solid var(--border)', borderRadius: '8px', padding: '7px 10px',
            background: 'transparent', color: 'var(--text)', fontSize: '12px', marginBottom: '16px',
          }}>
            Retry record check
          </button>
        )}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
        gap: '12px',
        marginBottom: '24px',
      }}>
        {primaryActions.map((item) => (
          <article key={item.to} style={{
            border: '1px solid var(--border)', borderRadius: '12px',
            padding: '16px', display: 'flex', flexDirection: 'column', minHeight: '190px',
            background: 'var(--bg)',
          }}>
            <p style={{ color: 'var(--trust)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', margin: '0 0 10px' }}>{item.eyebrow}</p>
            <h2 style={{ fontSize: '17px', lineHeight: 1.3, margin: '0 0 8px' }}>{item.title}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px', lineHeight: 1.55, margin: '0 0 16px', flex: 1 }}>{item.description}</p>
            <Link to={item.to} style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: '8px', padding: '10px 12px', textDecoration: 'none',
              background: 'var(--trust)', color: 'white', fontSize: '12px', fontWeight: 600,
            }}>{item.action} →</Link>
            {item.to === '/daily-care' && <Link to="/structured-daily-capture" style={{ display: 'inline-block', marginTop: '10px', fontSize: '11px', color: 'var(--trust)', textDecoration: 'none' }}>Use structured capture for medications, vitals and scales →</Link>}
          </article>
        ))}
      </div>

      <div>
        <h2 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 10px' }}>Explore the rest of SolenOS</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))', gap: '8px' }}>
          {secondaryAreas.map((item) => (
            <Link key={item.to + item.title} to={item.to} style={{
              display: 'block', border: '1px solid var(--border)', borderRadius: '10px',
              padding: '11px 12px', textDecoration: 'none', color: 'var(--text)',
            }}>
              <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>{item.title} ↗</span>
              <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '11px', lineHeight: 1.45 }}>{item.detail}</span>
            </Link>
          ))}
        </div>
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: '11px', lineHeight: 1.5, margin: '16px 0 0' }}>
        Source reports, extracted content, AI interpretations, and peer experiences have different evidentiary status. A response or extraction is not automatically a confirmed care-record fact.
      </p>
    </section>
  );
}
