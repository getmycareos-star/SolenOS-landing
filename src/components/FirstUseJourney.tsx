import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ensureAnonymousSession, getJSON, getPersonId } from '../api/client';
import CareContinuityIntegrityPanel from './CareContinuityIntegrityPanel';

type RecordState = 'loading' | 'empty' | 'existing' | 'unknown';

type CareEvent = {
  id: string;
  title?: string;
  event_type?: string;
  description?: string;
  occurred_at?: string;
  recorded_at?: string;
  created_at?: string;
};

type EvidenceRecord = {
  id: string;
  type?: string;
  source_text?: string;
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

type ChangeRecord = {
  id: string;
  change_type?: string;
  change_direction?: string;
  previous_state?: string | null;
  current_state?: string | null;
  explanation?: string | null;
  evidence_ids?: string[];
  comparison_window_start?: string | null;
  comparison_window_end?: string | null;
  confidence?: number;
  significance_verdict?: string | null;
  attention_candidate?: boolean;
  follow_up_candidate?: boolean;
  is_active?: boolean;
  created_at?: string;
};

type OpenQuestion = { id: string; question?: string; priority?: string; asked_at?: string; status?: string };
type Contradiction = { id: string; field?: string; description?: string; resolution_status?: string; evidence_ids?: string[]; created_at?: string };
type InformationGap = { id: string; field?: string; description?: string; priority?: string; lifecycle_status?: string; expected_by?: string | null };

type RecordSnapshot = {
  events: CareEvent[];
  evidence: EvidenceRecord[];
  actions: CareAction[];
  changes: ChangeRecord[];
  questions: OpenQuestion[];
  contradictions: Contradiction[];
  gaps: InformationGap[];
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
    action: 'Review or add documents',
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

function isOpenAction(action: CareAction): boolean {
  const status = (action.status || '').toLowerCase();
  return ['active', 'conditional', 'pending_confirmation', 'blocked'].includes(status);
}

function isOpenGap(gap: InformationGap): boolean {
  const status = (gap.lifecycle_status || '').toLowerCase();
  return !['resolved', 'closed', 'superseded'].includes(status);
}

function isOverdue(value?: string | null): boolean {
  if (!value) return false;
  // Date-only deadlines are due through the end of that calendar day, not at UTC midnight.
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const deadline = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), 23, 59, 59, 999).getTime()
    : Date.parse(value);
  return !Number.isNaN(deadline) && deadline < Date.now();
}

export default function FirstUseJourney() {
  const [recordState, setRecordState] = useState<RecordState>('loading');
  const [snapshot, setSnapshot] = useState<RecordSnapshot>({
    events: [],
    evidence: [],
    actions: [],
    changes: [],
    questions: [],
    contradictions: [],
    gaps: [],
    failedSections: [],
  });
  const [retry, setRetry] = useState(0);
  const personId = getPersonId();

  useEffect(() => {
    let active = true;
    async function inspectRecord() {
      setRecordState('loading');
      const names = ['care events', 'saved evidence and documents', 'recorded actions', 'change assessments', 'open questions', 'unresolved contradictions', 'information gaps'];
      let authorizedPersonId = personId;
      try {
        // The browser's person ID is not proof of access. Establish or refresh
        // the server-issued, person-scoped capability before requesting records.
        const session = await ensureAnonymousSession();
        authorizedPersonId = session.person?.id || getPersonId();
      } catch {
        if (!active) return;
        setSnapshot({ events: [], evidence: [], actions: [], changes: [], questions: [], contradictions: [], gaps: [], failedSections: ['authorised care-record session'] });
        setRecordState('unknown');
        return;
      }
      if (!authorizedPersonId) {
        if (!active) return;
        setSnapshot({ events: [], evidence: [], actions: [], changes: [], questions: [], contradictions: [], gaps: [], failedSections: ['care-record identity'] });
        setRecordState('unknown');
        return;
      }
      const encodedPersonId = encodeURIComponent(authorizedPersonId);
      const results = await Promise.allSettled([
        getJSON('/events/' + encodedPersonId + '?limit=5'),
        getJSON('/evidence/' + encodedPersonId),
        getJSON('/actions/' + encodedPersonId + '/uncompleted'),
        getJSON('/change/changes/' + encodedPersonId),
        getJSON('/uncertainty/questions/' + encodedPersonId + '?status=open'),
        getJSON('/uncertainty/contradictions/' + encodedPersonId + '?resolution_status=unresolved'),
        getJSON('/uncertainty/gaps/' + encodedPersonId),
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
      const changes = (arrays[3] || []) as ChangeRecord[];
      const questions = (arrays[4] || []) as OpenQuestion[];
      const contradictions = (arrays[5] || []) as Contradiction[];
      const gaps = (arrays[6] || []) as InformationGap[];
      setSnapshot({ events, evidence, actions, changes, questions, contradictions, gaps, failedSections });

      const hasSavedData = events.length > 0 || evidence.length > 0 || actions.length > 0 || changes.length > 0 || questions.length > 0 || contradictions.length > 0 || gaps.length > 0;
      const allSourcesVerifiedEmpty = results.every((result) =>
        result.status === 'fulfilled' && Array.isArray(result.value) && result.value.length === 0
      );
      setRecordState(hasSavedData ? 'existing' : allSourcesVerifiedEmpty ? 'empty' : 'unknown');
    }

    void inspectRecord().catch(() => {
      if (active) {
        setSnapshot({ events: [], evidence: [], actions: [], changes: [], questions: [], contradictions: [], gaps: [], failedSections: ['care record'] });
        setRecordState('unknown');
      }
    });
    return () => { active = false; };
  }, [personId, retry]);

  const openGaps = snapshot.gaps.filter(isOpenGap);
  const overdueActions = snapshot.actions.filter((action) => isOpenAction(action) && isOverdue(action.deadline));

  const orderedEvents = snapshot.events.slice().sort((a, b) => {
    const aTime = Date.parse(a.occurred_at || '');
    const bTime = Date.parse(b.occurred_at || '');
    // Missing event time stays unknown; entry time must not make an old report look new.
    return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
  });
  const latestEvent = orderedEvents[0];

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
                Event time: {displayDate(latestEvent.occurred_at)} · Entered into SolenOS: {displayDate(latestEvent.recorded_at || latestEvent.created_at)}
              </span>
            </p>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: '8px', marginBottom: '14px' }}>
            <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '10px' }}>
              <strong style={{ display: 'block', fontSize: '20px' }}>{snapshot.failedSections.includes('care events') ? '—' : snapshot.events.length}</strong>
              <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>Events returned</span>
            </div>
            <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '10px' }}>
              <strong style={{ display: 'block', fontSize: '20px' }}>{snapshot.failedSections.includes('saved evidence and documents') ? '—' : snapshot.evidence.length}</strong>
              <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>Evidence items returned</span>
            </div>
            <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '10px' }}>
              <strong style={{ display: 'block', fontSize: '20px' }}>{snapshot.failedSections.includes('recorded actions') ? '—' : snapshot.actions.length}</strong>
              <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>Active actions returned</span>
            </div>
          </div>

          {snapshot.events.length > 0 && (
            <div style={{ marginBottom: '14px' }}>
              <h3 style={{ fontSize: '13px', margin: '0 0 7px' }}>Recent recorded events</h3>
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                {orderedEvents.slice(0, 3).map((event) => (
                  <li key={event.id} style={{ fontSize: '12px', lineHeight: 1.5, marginBottom: '6px' }}>
                    {eventLabel(event)}
                    <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '11px' }}>
                      Event time: {displayDate(event.occurred_at)} · Entered: {displayDate(event.recorded_at || event.created_at)}
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

          {snapshot.changes.filter((item) => item.is_active !== false).length > 0 && (
            <div style={{ marginBottom: '14px' }}>
              <h3 style={{ fontSize: '13px', margin: '0 0 7px' }}>Persisted change assessments</h3>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '0 0 7px' }}>
                These are saved system assessments, not a fresh independent validation of the current situation. Assessment save time is not the event time; use the comparison window and source event times to judge whether a change is genuinely new.
              </p>
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                {snapshot.changes.filter((item) => item.is_active !== false).slice(0, 3).map((item) => (
                  <li key={item.id} style={{ fontSize: '12px', lineHeight: 1.5, marginBottom: '7px' }}>
                    <strong>{item.change_type || 'Recorded change'}</strong>
                    {item.change_direction ? ' · ' + item.change_direction : ''}
                    {item.previous_state || item.current_state ? (
                      <span style={{ display: 'block' }}>
                        {item.previous_state || 'Previous state not recorded'} → {item.current_state || 'Current state not recorded'}
                      </span>
                    ) : null}
                    {item.explanation && <span style={{ display: 'block' }}>{item.explanation}</span>}
                    <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '11px' }}>
                      Assessment saved: {displayDate(item.created_at)} · Comparison window: {item.comparison_window_start ? displayDate(item.comparison_window_start) : 'start not recorded'} to {item.comparison_window_end ? displayDate(item.comparison_window_end) : 'end not recorded'} · Evidence references: {Array.isArray(item.evidence_ids) ? item.evidence_ids.length : 0}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {snapshot.questions.length > 0 && (
            <div style={{ marginBottom: '14px' }}>
              <h3 style={{ fontSize: '13px', margin: '0 0 7px' }}>Open questions already recorded</h3>
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                {snapshot.questions.slice(0, 3).map((item) => (
                  <li key={item.id} style={{ fontSize: '12px', lineHeight: 1.5, marginBottom: '6px' }}>
                    {item.question || 'Open question text unavailable'}
                    <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '11px' }}>
                      {item.priority ? 'Recorded priority: ' + item.priority + ' · ' : ''}Asked: {displayDate(item.asked_at)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {snapshot.contradictions.length > 0 && (
            <div style={{ marginBottom: '14px' }}>
              <h3 style={{ fontSize: '13px', margin: '0 0 7px' }}>Unresolved conflicting reports</h3>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '0 0 7px' }}>
                Competing accounts are shown as unresolved; this screen does not choose which account is true.
              </p>
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                {snapshot.contradictions.slice(0, 3).map((item) => (
                  <li key={item.id} style={{ fontSize: '12px', lineHeight: 1.5, marginBottom: '6px' }}>
                    {item.field ? item.field + ': ' : ''}{item.description || 'Conflict description unavailable'}
                    <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '11px' }}>
                      Status: {item.resolution_status || 'unresolved'} · Evidence references: {Array.isArray(item.evidence_ids) ? item.evidence_ids.length : 0}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {openGaps.length > 0 && (
            <div style={{ marginBottom: '14px' }}>
              <h3 style={{ fontSize: '13px', margin: '0 0 7px' }}>Known information gaps</h3>
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                {openGaps.slice(0, 3).map((item) => (
                  <li key={item.id} style={{ fontSize: '12px', lineHeight: 1.5, marginBottom: '6px' }}>
                    {item.field ? item.field + ': ' : ''}{item.description || 'Information gap recorded'}
                    <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '11px' }}>
                      {item.priority ? 'Recorded priority: ' + item.priority + ' · ' : ''}{item.lifecycle_status || 'open'}{item.expected_by ? ' · Expected by: ' + displayDate(item.expected_by) : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {snapshot.events.length === 0 && !snapshot.failedSections.includes('care events') && (
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              No care events were returned by the event endpoint. The other saved information shown here may still be useful; absence of events is not evidence that care needs have remained unchanged.
            </p>
          )}
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '12px 0 0' }}>
            These are records retrieved from the current API. This screen does not yet establish which entries changed since your last review or whether active actions remain appropriate.
          </p>
        </section>
      )}

      {recordState === 'existing' && (
        <section aria-label="Missing information and overdue follow-ups" style={{
          border: '1px solid var(--border)', borderRadius: '12px', padding: '16px',
          marginBottom: '22px', background: 'var(--bg)',
        }}>
          <h2 style={{ fontSize: '17px', margin: '0 0 6px' }}>Missing information & follow-ups</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            “Not recorded” means the current record does not contain this information; it does not mean the condition or event is absent. If a caregiver reports checking and not observing something, preserve that as a sourced report—not proof of absence or independent clinical confirmation.
          </p>
          {snapshot.failedSections.length > 0 && (
            <p role="alert" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Some sources could not be checked ({snapshot.failedSections.join(', ')}); follow-up status may be incomplete.
            </p>
          )}
          {openGaps.length > 0 ? (
            <div>
              <h3 style={{ fontSize: '13px', margin: '12px 0 6px' }}>Information gaps recorded</h3>
              <ul style={{ paddingLeft: '20px', margin: 0 }}>
                {openGaps.map((gap) => {
                  const overdue = isOverdue(gap.expected_by) && !['resolved', 'closed', 'superseded'].includes((gap.lifecycle_status || '').toLowerCase());
                  return <li key={gap.id} style={{ fontSize: '12px', marginBottom: '8px' }}>
                    <strong>{gap.field || 'Information not recorded'}</strong>: {gap.description || 'The record has an identified information gap.'}
                    <span style={{ display: 'block', color: overdue ? 'var(--error)' : 'var(--text-secondary)', fontSize: '11px' }}>
                      {overdue ? 'Overdue follow-up' : 'Status'} · {gap.lifecycle_status || 'open'} · Due: {displayDate(gap.expected_by)}
                    </span>
                  </li>;
                })}
              </ul>
            </div>
          ) : !snapshot.failedSections.includes('information gaps') ? (
            <p style={{ fontSize: '12px', margin: '8px 0' }}>No unresolved information-gap records were returned. This does not confirm that all care information is complete or that a concern is absent.</p>
          ) : null}
          {overdueActions.length > 0 && (
            <div>
              <h3 style={{ fontSize: '13px', margin: '12px 0 6px' }}>Overdue open actions</h3>
              <ul style={{ paddingLeft: '20px', margin: 0 }}>
                {overdueActions.map((action) => (
                  <li key={action.id} style={{ fontSize: '12px', marginBottom: '7px' }}>
                    {actionLabel(action)}
                    <span style={{ display: 'block', color: 'var(--error)', fontSize: '11px' }}>Due {displayDate(action.deadline)} · Status: {action.status || 'unknown'}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
      {recordState === 'existing' && (
        <CareContinuityIntegrityPanel
          personId={getPersonId() || ''}
          evidenceAvailable={!snapshot.failedSections.includes('saved evidence and documents')}
          evidenceItems={snapshot.evidence.map((item) => ({
            id: item.id,
            type: item.type || 'Evidence',
            source_text: item.source_text || '',
            uploaded_at: item.uploaded_at || item.created_at || '',
          }))}
        />
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
