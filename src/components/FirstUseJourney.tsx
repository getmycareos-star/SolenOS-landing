import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getJSON, getPersonId } from '../api/client';

type RecordState = 'loading' | 'empty' | 'existing' | 'unknown';

type CareEvent = {
  id: string;
  title?: string;
  event_type?: string;
  description?: string;
  occurred_at?: string;
  recorded_at?: string;
};

type EvidenceRecord = {
  id: string;
  type?: string;
  title?: string;
  file_name?: string;
  source_label?: string;
  created_at?: string;
  uploaded_at?: string;
  recorded_at?: string;
};

type CareAction = {
  id: string;
  normalized_action?: string;
  action_object?: string;
  original_text?: string;
  status?: string;
  deadline?: string | null;
  created_at?: string;
};

type RecordSnapshot = {
  events: CareEvent[];
  evidence: EvidenceRecord[];
  actions: CareAction[];
  failedSections: string[];
};

const primaryActions = [
  {
    to: '/daily-care',
    eyebrow: 'CAPTURE',
    title: 'Record what happened',
    description: 'Add a new observation or concern without replacing earlier reports.',
    action: 'Start Daily Capture',
  },
  {
    to: '/companion',
    eyebrow: 'UNDERSTAND',
    title: 'Continue with AI Companion',
    description: 'Ask a care-related question. AI responses are not automatically confirmed facts in the care record.',
    action: 'Open Companion',
  },
  {
    to: '/record',
    eyebrow: 'DOCUMENTS & RECORD',
    title: 'Review or add documents',
    description: 'Open the existing record and use the document intake that is currently supported.',
    action: 'Open Living Care Record',
  },
];

const secondaryAreas = [
  { to: '/dashboard', title: 'Dashboard overview', detail: 'Review available events, insights, and recorded actions.' },
  { to: '/record', title: 'Living Care Record', detail: 'Review saved evidence and the evolving care account.' },
  { to: '/community', title: 'Community', detail: 'Explore peer experiences separately from this person’s care record.' },
  { to: '/timeline', title: 'Timeline', detail: 'Review recorded events in time order.' },
  { to: '/insights', title: 'Insights', detail: 'Review available derived observations with appropriate caution.' },
  { to: '/memory', title: 'Care memory', detail: 'Review available remembered care context.' },
  { to: '/care-circle', title: 'Care circle', detail: 'Explore the existing care coordination area.' },
];

function displayDate(value?: string | null): string {
  if (!value) return 'Date not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date not recorded';
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function eventLabel(event: CareEvent): string {
  return event.title?.trim() || event.description?.trim() || event.event_type?.trim() || 'Recorded care event';
}

function evidenceLabel(item: EvidenceRecord): string {
  return item.title?.trim() || item.file_name?.trim() || item.source_label?.trim() || item.type?.trim() || 'Saved evidence';
}

function actionLabel(action: CareAction): string {
  return action.normalized_action?.trim() || action.action_object?.trim() || action.original_text?.trim() || 'Recorded action';
}

export default function FirstUseJourney() {
  const [recordState, setRecordState] = useState<RecordState>('loading');
  const [snapshot, setSnapshot] = useState<RecordSnapshot>({
    events: [],
    evidence: [],
    actions: [],
    failedSections: [],
  });
  const [retry, setRetry] = useState(0);
  const personId = getPersonId();

  useEffect(() => {
    let active = true;
    async function inspectRecord() {
      if (!personId) {
        setSnapshot({ events: [], evidence: [], actions: [], failedSections: ['care-record identity'] });
        setRecordState('unknown');
        return;
      }

      setRecordState('loading');
      const names = ['care events', 'saved evidence and documents', 'recorded actions'];
      const results = await Promise.allSettled([
        getJSON('/events/' + encodeURIComponent(personId) + '?limit=5'),
        getJSON('/evidence/' + encodeURIComponent(personId)),
        getJSON('/actions/' + encodeURIComponent(personId) + '?status=active'),
      ]);
      if (!active) return;

      const arrays = results.map((result) =>
        result.status === 'fulfilled' && Array.isArray(result.value) ? result.value : null
      );
      const failedSections = results.flatMap((result, index) =>
        result.status === 'fulfilled' && Array.isArray(result.value) ? [] : [names[index]]
      );
      const events = (arrays[0] || []) as CareEvent[];
      const evidence = (arrays[1] || []) as EvidenceRecord[];
      const actions = (arrays[2] || []) as CareAction[];
      setSnapshot({ events, evidence, actions, failedSections });

      const hasSavedData = events.length > 0 || evidence.length > 0 || actions.length > 0;
      const allSourcesVerifiedEmpty = results.every((result) =>
        result.status === 'fulfilled' && Array.isArray(result.value) && result.value.length === 0
      );
      setRecordState(hasSavedData ? 'existing' : allSourcesVerifiedEmpty ? 'empty' : 'unknown');
    }

    void inspectRecord().catch(() => {
      if (active) {
        setSnapshot({ events: [], evidence: [], actions: [], failedSections: ['care record'] });
        setRecordState('unknown');
      }
    });
    return () => { active = false; };
  }, [personId, retry]);

  const latestEvent = snapshot.events
    .slice()
    .sort((a, b) => {
      const aTime = Date.parse(a.occurred_at || a.recorded_at || '');
      const bTime = Date.parse(b.occurred_at || b.recorded_at || '');
      return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
    })[0];

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
          {recordState === 'existing' ? 'Continue from your care history.' : 'Keep the care story connected.'}
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: 1.65, margin: '0 0 12px' }}>
          {recordState === 'existing'
            ? 'Your saved care information is available below. Review what was recorded, continue capturing new information, or open the relevant part of SolenOS.'
            : 'SolenOS helps family caregivers bring observations, events, and care documents together over time—so it is easier to review what was reported, what may have changed, what remains unclear, and what to ask next.'}
        </p>
        <p role="status" aria-live="polite" style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 22px' }}>
          {recordState === 'loading' && 'Checking your authorised care record…'}
          {recordState === 'empty' && 'The checked care events, evidence, and action sources contain no saved entries yet. Start wherever it is easiest; you do not need to complete a profile first.'}
          {recordState === 'existing' && 'Saved care information was found. This view reflects returned records; missing entries do not establish that nothing happened.'}
          {recordState === 'unknown' && 'The current record state could not be confirmed. SolenOS will not assume that the record is empty or switch to another record.'}
        </p>
        {(recordState === 'unknown' || snapshot.failedSections.length > 0) && (
          <div style={{ marginBottom: '18px' }}>
            {snapshot.failedSections.length > 0 && (
              <p role="alert" style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                Could not verify: {snapshot.failedSections.join(', ')}. Any sections below are limited to successfully retrieved records; unavailable information is not treated as absent.
              </p>
            )}
            <button type="button" onClick={() => setRetry((value) => value + 1)} style={{
              border: '1px solid var(--border)', borderRadius: '8px', padding: '7px 10px',
              background: 'transparent', color: 'var(--text)', fontSize: '12px',
            }}>
              Retry record check
            </button>
          </div>
        )}
      </div>

      {recordState === 'existing' && (
        <section aria-label="Current orientation from saved care records" style={{
          border: '1px solid var(--border)', borderRadius: '12px', padding: '16px',
          marginBottom: '22px', background: 'var(--bg)',
        }}>
          <h2 style={{ fontSize: '17px', margin: '0 0 6px' }}>Your saved care context</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px', lineHeight: 1.55, margin: '0 0 14px' }}>
            This is a record orientation, not a clinical assessment. It does not infer stability, improvement, deterioration, or causes from missing entries.
          </p>
          {latestEvent && (
            <p style={{ fontSize: '13px', margin: '0 0 14px' }}>
              <strong>Latest event returned:</strong> {eventLabel(latestEvent)}
              <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '11px', marginTop: '3px' }}>
                Reported/recorded time: {displayDate(latestEvent.occurred_at || latestEvent.recorded_at)}
              </span>
            </p>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: '8px', marginBottom: '14px' }}>
            <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '10px' }}>
              <strong style={{ display: 'block', fontSize: '20px' }}>{snapshot.events.length}</strong>
              <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>Events returned</span>
            </div>
            <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '10px' }}>
              <strong style={{ display: 'block', fontSize: '20px' }}>{snapshot.evidence.length}</strong>
              <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>Evidence items returned</span>
            </div>
            <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '10px' }}>
              <strong style={{ display: 'block', fontSize: '20px' }}>{snapshot.actions.length}</strong>
              <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>Active actions returned</span>
            </div>
          </div>

          {snapshot.events.length > 0 && (
            <div style={{ marginBottom: '14px' }}>
              <h3 style={{ fontSize: '13px', margin: '0 0 7px' }}>Recent recorded events</h3>
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                {snapshot.events.slice(0, 3).map((event) => (
                  <li key={event.id} style={{ fontSize: '12px', lineHeight: 1.5, marginBottom: '6px' }}>
                    {eventLabel(event)}
                    <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '11px' }}>
                      {displayDate(event.occurred_at || event.recorded_at)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {snapshot.evidence.length > 0 && (
            <div style={{ marginBottom: '14px' }}>
              <h3 style={{ fontSize: '13px', margin: '0 0 7px' }}>Saved evidence and documents</h3>
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                {snapshot.evidence.slice(0, 3).map((item) => (
                  <li key={item.id} style={{ fontSize: '12px', lineHeight: 1.5, marginBottom: '5px' }}>
                    {evidenceLabel(item)}
                    <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '11px' }}>
                      {displayDate(item.uploaded_at || item.created_at || item.recorded_at)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {snapshot.actions.length > 0 && (
            <div style={{ marginBottom: '14px' }}>
              <h3 style={{ fontSize: '13px', margin: '0 0 7px' }}>Recorded active actions</h3>
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                {snapshot.actions.slice(0, 3).map((action) => (
                  <li key={action.id} style={{ fontSize: '12px', lineHeight: 1.5, marginBottom: '5px' }}>
                    {actionLabel(action)}
                    {action.deadline && <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '11px' }}>Recorded due date: {displayDate(action.deadline)}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {snapshot.events.length === 0 && (
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              No care events were returned by the event endpoint. The other saved information shown here may still be useful; absence of events is not evidence that care needs have remained unchanged.
            </p>
          )}
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '12px 0 0' }}>
            These are records retrieved from the current API. This screen does not yet establish which entries changed since your last review or whether active actions remain appropriate.
          </p>
        </section>
      )}

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
