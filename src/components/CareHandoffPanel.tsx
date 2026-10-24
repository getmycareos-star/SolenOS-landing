import { FormEvent, useCallback, useEffect, useState } from 'react';
import { getCaregiverId, getJSON, postJSON } from '../api/client';

type Caregiver = { id: string; name: string; relationship?: string };
type Handoff = {
  id: string;
  person_id: string;
  created_by_caregiver_id: string;
  assigned_to_caregiver_id?: string | null;
  title: string;
  summary: string;
  outstanding_items: string[];
  recent_changes: string[];
  safety_concerns: string[];
  status: 'open' | 'acknowledged' | 'closed' | string;
  access_scope?: 'care_circle' | 'assigned_only';
  due_at?: string | null;
  reminder_at?: string | null;
  completion_report?: string | null;
  completed_by_caregiver_id?: string | null;
  completed_at?: string | null;
  acknowledged_by_caregiver_id?: string | null;
  acknowledged_at?: string | null;
  closed_by_caregiver_id?: string | null;
  closed_at?: string | null;
  created_at: string;
};
type HandoffEvent = {
  id: string;
  event_type: string;
  actor_caregiver_id: string;
  created_at: string;
};
type HandoffReminder = {
  id: string;
  handoff_id?: string | null;
  enabled: boolean;
  next_run_at?: string | null;
};
type ReminderDelivery = {
  id: string;
  status: string;
  delivered_at?: string | null;
  attempt_count: number;
  last_error?: string | null;
};

function splitItems(value: string): string[] {
  return value.split('\n').map(item => item.trim()).filter(Boolean);
}

export default function CareHandoffPanel({ personId }: { personId: string }) {
  const [caregiverId] = useState(() => getCaregiverId() || '');
  const [caregivers, setCaregivers] = useState<Caregiver[]>([]);
  const [handoffs, setHandoffs] = useState<Handoff[]>([]);
  const [eventsByHandoff, setEventsByHandoff] = useState<Record<string, HandoffEvent[]>>({});
  const [remindersByHandoff, setRemindersByHandoff] = useState<Record<string, HandoffReminder>>({});
  const [deliveriesByHandoff, setDeliveriesByHandoff] = useState<Record<string, ReminderDelivery[]>>({});
  const [reminderStatusError, setReminderStatusError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [outstanding, setOutstanding] = useState('');
  const [changes, setChanges] = useState('');
  const [concerns, setConcerns] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [reminderAt, setReminderAt] = useState('');
  const [accessScope, setAccessScope] = useState<'care_circle' | 'assigned_only'>('care_circle');
  const [completionReports, setCompletionReports] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!personId || !caregiverId) {
      setHandoffs([]);
      setLoading(false);
      setError('A valid, authenticated care session is required to view family handoffs.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [handoffData, caregiverData, reminderResponse] = await Promise.all([
        getJSON(`/care-handoffs/people/${encodeURIComponent(personId)}`),
        getJSON(`/caregivers/${encodeURIComponent(personId)}`),
        getJSON(`/reminders/people/${encodeURIComponent(personId)}`).catch(() => null),
      ]);
      if (!Array.isArray(handoffData) || !Array.isArray(caregiverData)) {
        throw new Error('The server returned an incomplete handoff response.');
      }
      setHandoffs(handoffData as Handoff[]);
      setCaregivers(caregiverData as Caregiver[]);
      const reminders = Array.isArray(reminderResponse) ? reminderResponse as HandoffReminder[] : [];
      const handoffReminders = reminders.filter(item => item.handoff_id);
      const reminderMap = Object.fromEntries(handoffReminders.map(item => [String(item.handoff_id), item]));
      setRemindersByHandoff(reminderMap);
      setReminderStatusError(reminderResponse === null ? 'Reminder delivery status is currently unavailable.' : null);
      const deliveryResults = await Promise.all(handoffReminders.map(async reminder => {
        try {
          const deliveries = await getJSON(`/reminders/${encodeURIComponent(reminder.id)}/deliveries`);
          return [String(reminder.handoff_id), Array.isArray(deliveries) ? deliveries as ReminderDelivery[] : []] as const;
        } catch {
          return [String(reminder.handoff_id), []] as const;
        }
      }));
      setDeliveriesByHandoff(Object.fromEntries(deliveryResults));
      const eventResults = await Promise.all((handoffData as Handoff[]).map(async item => {
        try {
          const events = await getJSON(`/care-handoffs/${encodeURIComponent(item.id)}/events`);
          return [item.id, Array.isArray(events) ? events as HandoffEvent[] : []] as const;
        } catch {
          return [item.id, []] as const;
        }
      }));
      setEventsByHandoff(Object.fromEntries(eventResults));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Family handoffs could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [personId, caregiverId]);

  useEffect(() => { void load(); }, [load]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!personId || !caregiverId) {
      setError('A valid, authenticated care session is required.');
      return;
    }
    if (reminderAt && !dueAt) { setError('Choose a due date before setting a reminder target.'); return; }
    if (reminderAt && dueAt && new Date(reminderAt).getTime() > new Date(dueAt).getTime()) { setError('The reminder target must be at or before the due date.'); return; }
    if (accessScope === 'assigned_only' && !assignedTo) { setError('Choose an assigned caregiver for a restricted handoff.'); return; }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await postJSON('/care-handoffs', {
        person_id: personId,
        assigned_to_caregiver_id: assignedTo || null,
        title: title.trim(),
        summary: summary.trim(),
        outstanding_items: splitItems(outstanding),
        recent_changes: splitItems(changes),
        safety_concerns: splitItems(concerns),
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        reminder_at: reminderAt ? new Date(reminderAt).toISOString() : null,
        access_scope: accessScope,
      });
      setTitle('');
      setSummary('');
      setAssignedTo('');
      setOutstanding('');
      setChanges('');
      setConcerns('');
      setDueAt('');
      setReminderAt('');
      setAccessScope('care_circle');
      setNotice('Handoff saved. The next caregiver can review and acknowledge it.');
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Handoff could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const transition = async (handoffId: string, action: 'acknowledge' | 'close') => {
    setError(null);
    setNotice(null);
    const completionReport = (completionReports[handoffId] || '').trim();
    if (action === 'close' && !completionReport) {
      setError('Add a completion report before closing this handoff.');
      return;
    }
    try {
      await postJSON(`/care-handoffs/${encodeURIComponent(handoffId)}/${action}`, action === 'close' ? { completion_report: completionReport } : {});
      setNotice(action === 'acknowledge' ? 'Handoff acknowledged and recorded.' : 'Handoff closed and recorded.');
      await load();
    } catch (transitionError) {
      setError(transitionError instanceof Error ? transitionError.message : 'Handoff status could not be updated.');
    }
  };

  const caregiverName = (id?: string | null) => caregivers.find(item => item.id === id)?.name || 'Linked caregiver';
  const fieldStyle = { display: 'block', width: '100%', boxSizing: 'border-box' as const, padding: '9px 10px', marginTop: '5px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg)', color: 'var(--text)', font: 'inherit' };

  return (
    <section aria-labelledby="family-handoffs-heading" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 20px', marginBottom: '24px' }}>
      <h2 id="family-handoffs-heading" style={{ fontSize: '18px', fontWeight: 600, marginBottom: '6px' }}>Family handoffs</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px' }}>
        Share what changed, what remains open, and any concerns. Handoffs are attributed to the signed-in caregiver and remain in the care record.
      </p>
      <section aria-label="Family care briefing" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
        <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', flex: '1 1 120px' }}>
          <strong style={{ display: 'block', fontSize: '18px' }}>{handoffs.filter(item => item.status !== 'closed').length}</strong>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Open handoffs</span>
        </div>
        <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', flex: '1 1 120px' }}>
          <strong style={{ display: 'block', fontSize: '18px' }}>{handoffs.filter(item => item.status !== 'closed' && item.due_at && Date.parse(item.due_at) < Date.now()).length}</strong>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Overdue</span>
        </div>
        <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', flex: '1 1 120px' }}>
          <strong style={{ display: 'block', fontSize: '18px' }}>{handoffs.filter(item => item.status !== 'closed' && item.assigned_to_caregiver_id === caregiverId).length}</strong>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Assigned to you</span>
        </div>
      </section>
      {reminderStatusError && <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '12px' }}>{reminderStatusError} Handoff records remain available; delivery is not assumed.</p>}
      {error && <p role="alert" style={{ color: 'var(--unknown)', fontSize: '13px', marginBottom: '12px' }}>{error}</p>}
      {notice && <p role="status" style={{ color: 'var(--trust)', fontSize: '13px', marginBottom: '12px' }}>{notice}</p>}

      <form onSubmit={submit} style={{ display: 'grid', gap: '12px', marginBottom: '20px' }}>
        <label style={{ fontSize: '13px' }}>Handoff title
          <input required maxLength={180} value={title} onChange={event => setTitle(event.target.value)} style={fieldStyle} placeholder="e.g. Evening-to-morning handoff" />
        </label>
        <label style={{ fontSize: '13px' }}>Summary for the next caregiver
          <textarea required maxLength={10000} rows={3} value={summary} onChange={event => setSummary(event.target.value)} style={fieldStyle} placeholder="What does the next caregiver need to know?" />
        </label>
        <label style={{ fontSize: '13px' }}>Assign to caregiver
          <select value={assignedTo} onChange={event => setAssignedTo(event.target.value)} style={fieldStyle}>
            <option value="">No specific assignee</option>
            {caregivers.map(caregiver => <option key={caregiver.id} value={caregiver.id}>{caregiver.name}{caregiver.relationship ? ` · ${caregiver.relationship}` : ''}</option>)}
          </select>
        </label>
        <label style={{ fontSize: '13px' }}>Due date and time (optional)
          <input aria-label="Handoff due date and time" type="datetime-local" value={dueAt} onChange={event => setDueAt(event.target.value)} style={fieldStyle} />
        </label>
        <label style={{ fontSize: '13px' }}>Reminder target (optional; requires the reminder delivery service to be enabled)
          <input aria-label="Handoff reminder target" type="datetime-local" value={reminderAt} onChange={event => setReminderAt(event.target.value)} style={fieldStyle} />
        </label>
        <label style={{ fontSize: '13px' }}>Who can see this handoff?
          <select aria-label="Handoff access scope" value={accessScope} onChange={event => setAccessScope(event.target.value as 'care_circle' | 'assigned_only')} style={fieldStyle}>
            <option value="care_circle">All linked caregivers</option>
            <option value="assigned_only">Creator and assigned caregiver only</option>
          </select>
        </label>
        <label style={{ fontSize: '13px' }}>Outstanding items <span style={{ color: 'var(--text-secondary)' }}>(one per line)</span>
          <textarea rows={2} value={outstanding} onChange={event => setOutstanding(event.target.value)} style={fieldStyle} placeholder="Confirm the appointment" />
        </label>
        <label style={{ fontSize: '13px' }}>Recent changes <span style={{ color: 'var(--text-secondary)' }}>(one per line)</span>
          <textarea rows={2} value={changes} onChange={event => setChanges(event.target.value)} style={fieldStyle} placeholder="What changed since the previous handoff?" />
        </label>
        <label style={{ fontSize: '13px' }}>Safety concerns or follow-up cautions <span style={{ color: 'var(--text-secondary)' }}>(one per line)</span>
          <textarea rows={2} value={concerns} onChange={event => setConcerns(event.target.value)} style={fieldStyle} placeholder="Record concerns without presenting unverified reports as confirmed facts" />
        </label>
        <div>
          <button type="submit" disabled={saving || loading || !personId || !caregiverId} style={{ padding: '9px 14px', border: 0, borderRadius: '6px', background: 'var(--trust)', color: '#fff', cursor: saving ? 'wait' : 'pointer' }}>
            {saving ? 'Saving handoff…' : 'Save handoff'}
          </button>
        </div>
      </form>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {loading && <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Loading handoffs…</p>}
        {!loading && handoffs.length === 0 && !error && <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>No family handoffs recorded yet.</p>}
        {handoffs.map(item => (
          <article key={item.id} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 5px' }}>{item.title}</h3>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>
                  {item.status.replace('_', ' ')} · Created by {caregiverName(item.created_by_caregiver_id)} · {item.created_at ? new Date(item.created_at).toLocaleString() : 'Recorded time unavailable'}
                </p>
                {item.assigned_to_caregiver_id && <p style={{ fontSize: '12px', marginTop: '5px' }}>Assigned to: {caregiverName(item.assigned_to_caregiver_id)}</p>}
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '5px' }}>Visibility: {item.access_scope === 'assigned_only' ? 'creator and assigned caregiver' : 'all linked caregivers'}</p>
                {item.due_at && <p style={{ fontSize: '12px', marginTop: '5px', color: new Date(item.due_at).getTime() < Date.now() && item.status !== 'closed' ? 'var(--unknown)' : 'var(--text-secondary)' }}>{new Date(item.due_at).getTime() < Date.now() && item.status !== 'closed' ? 'OVERDUE · ' : 'Due · '}{new Date(item.due_at).toLocaleString()}</p>}
                {item.reminder_at && <div style={{ marginTop: '5px' }}>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>Reminder target: {new Date(item.reminder_at).toLocaleString()}</p>
                  {(() => {
                    const reminder = remindersByHandoff[item.id];
                    const deliveries = deliveriesByHandoff[item.id] || [];
                    if (!reminder) return <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '3px' }}>No reminder record is visible; delivery is not confirmed.</p>;
                    if (deliveries.length === 0) return <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '3px' }}>Reminder record exists; no delivery receipt is available yet.</p>;
                    return <ul style={{ margin: '3px 0 0', paddingLeft: '18px' }}>{deliveries.slice(0, 3).map(delivery => <li key={delivery.id} style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Delivery {delivery.status.replace('_', ' ')} · attempts {delivery.attempt_count}{delivery.delivered_at ? ` · delivered ${new Date(delivery.delivered_at).toLocaleString()}` : ''}{delivery.last_error ? ` · ${delivery.last_error}` : ''}</li>)}</ul>;
                  })()}
                </div>}
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {item.status === 'open' && (!item.assigned_to_caregiver_id || item.assigned_to_caregiver_id === caregiverId) && (
                  <button type="button" onClick={() => void transition(item.id, 'acknowledge')} style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg)', color: 'var(--text)' }}>Acknowledge</button>
                )}
                {item.status !== 'closed' && (!item.assigned_to_caregiver_id || item.assigned_to_caregiver_id === caregiverId || item.created_by_caregiver_id === caregiverId) && (
                  <button type="button" onClick={() => void transition(item.id, 'close')} style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg)', color: 'var(--text)' }}>Submit report and close</button>
                )}
              </div>
            </div>
            <p style={{ fontSize: '13px', lineHeight: 1.5, margin: '10px 0' }}>{item.summary}</p>
            {item.recent_changes?.length > 0 && <div style={{ marginTop: '8px' }}><strong style={{ fontSize: '12px' }}>Recent changes</strong><ul style={{ margin: '4px 0', paddingLeft: '20px' }}>{item.recent_changes.map((text, index) => <li key={index} style={{ fontSize: '12px', marginBottom: '3px' }}>{text}</li>)}</ul></div>}
            {item.outstanding_items?.length > 0 && <div style={{ marginTop: '8px' }}><strong style={{ fontSize: '12px' }}>Still outstanding</strong><ul style={{ margin: '4px 0', paddingLeft: '20px' }}>{item.outstanding_items.map((text, index) => <li key={index} style={{ fontSize: '12px', marginBottom: '3px' }}>{text}</li>)}</ul></div>}
            {item.safety_concerns?.length > 0 && <div style={{ marginTop: '8px' }}><strong style={{ fontSize: '12px', color: 'var(--unknown)' }}>Safety concerns / cautions</strong><ul style={{ margin: '4px 0', paddingLeft: '20px' }}>{item.safety_concerns.map((text, index) => <li key={index} style={{ fontSize: '12px', marginBottom: '3px' }}>{text}</li>)}</ul></div>}
            {item.status !== 'closed' && (!item.assigned_to_caregiver_id || item.assigned_to_caregiver_id === caregiverId || item.created_by_caregiver_id === caregiverId) && <label style={{ display: 'block', fontSize: '12px', marginTop: '10px' }}>Completion report (required to close)
              <textarea aria-label={`Completion report for ${item.title}`} maxLength={5000} rows={2} value={completionReports[item.id] || ''} onChange={event => setCompletionReports(current => ({ ...current, [item.id]: event.target.value }))} style={fieldStyle} placeholder="What was completed, what remains open, and who confirmed it?" />
            </label>}
            {item.completion_report && <div style={{ marginTop: '10px', padding: '10px', border: '1px solid var(--border)', borderRadius: '6px' }}><strong style={{ fontSize: '12px' }}>Completion report</strong><p style={{ fontSize: '12px', marginTop: '5px' }}>{item.completion_report}</p><p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>Reported by {caregiverName(item.completed_by_caregiver_id)} · {item.completed_at ? new Date(item.completed_at).toLocaleString() : 'Time unavailable'}. This is a caregiver report, not independent verification.</p></div>}
            {item.acknowledged_at && <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '8px' }}>Acknowledged by {caregiverName(item.acknowledged_by_caregiver_id)} · {new Date(item.acknowledged_at).toLocaleString()}</p>}
            {item.closed_at && <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>Closed by {caregiverName(item.closed_by_caregiver_id)} · {new Date(item.closed_at).toLocaleString()}</p>}
            {(eventsByHandoff[item.id] || []).length > 0 && <details style={{ marginTop: '10px' }}><summary style={{ cursor: 'pointer', fontSize: '12px' }}>Audit history ({eventsByHandoff[item.id]?.length || 0})</summary><ol style={{ margin: '6px 0', paddingLeft: '20px' }}>{eventsByHandoff[item.id].map(event => <li key={event.id} style={{ fontSize: '11px', marginBottom: '4px' }}>{event.event_type} · {caregiverName(event.actor_caregiver_id)} · {new Date(event.created_at).toLocaleString()}</li>)}</ol></details>}
          </article>
        ))}
      </div>
    </section>
  );
}
