import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { getJSON, postJSON, deleteJSON, getPersonId } from '../api/client';
import { useOptimisticToggle } from '../lib/optimistic';
import CareCapture from '../components/CareCapture';

interface Event {
  id: string;
  event_type: string;
  occurred_at: string;
  title: string;
  description?: string;
  time_provenance?: string;
  location?: string;
}

interface Insight {
  id: string;
  title: string;
  description: string;
  confidence: number;
  insight_type: string;
  possible_context?: string;
  time_provenance?: string;
}

interface ObservationTrend {
  tag: string;
  count: number;
  first_observed: string;
  last_observed: string;
  trend: string;
}

interface ReasoningSummary {
  confirmed_facts: Array<{ key: string; value: any[]; confidence: number }>;
  open_questions: Array<{ key: string; value: any[] }>;
  preferences: Array<{ key: string; value: any[] }>;
  rejected_assumptions: Array<{ key: string; value: any[] }>;
  care_patterns: Array<{ key: string; value: any[] }>;
  coordination_decisions: Array<{ key: string; value: any[] }>;
}

interface DailyIntelligence {
  id: string;
  intelligence_date: string;
  overdue_items: any[];
  upcoming_items: any[];
  active_windows: any[];
  expired_windows: any[];
  daily_summary: string;
}

interface Action {
  id: string;
  title: string;
  description?: string;
  status: string;
  created_at: string;
  is_medication_action: boolean;
  requires_confirmation: boolean;
}

interface Reminder {
  id: string;
  action_id: string;
  title: string;
  message: string;
  next_run_at: string | null;
  timezone: string;
  recurrence: 'once' | 'daily' | 'weekly';
  local_time: string;
  enabled: boolean;
}

interface ReminderDelivery {
  id: string;
  reminder_id: string;
  scheduled_for: string;
  status: string;
  attempt_count: number;
  next_attempt_at: string;
  last_error?: string | null;
  delivered_at?: string | null;
}

export default function Dashboard() {
  const [events, setEvents] = useState<Event[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [trends, setTrends] = useState<ObservationTrend[]>([]);
  const [reasoning, setReasoning] = useState<ReasoningSummary | null>(null);
  const [dailyIntel, setDailyIntel] = useState<DailyIntelligence | null>(null);
  const [actions, setActions] = useState<Action[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [deliveries, setDeliveries] = useState<ReminderDelivery[]>([]);
  const [reminderActionId, setReminderActionId] = useState('');
  const [completionNotes, setCompletionNotes] = useState<Record<string, string>>({});
  const [reminderError, setReminderError] = useState<string | null>(null);
  const [reminderNotice, setReminderNotice] = useState<string | null>(null);
  const [reminderSaving, setReminderSaving] = useState(false);
  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderMessage, setReminderMessage] = useState('');
  const [reminderDueAt, setReminderDueAt] = useState('');
  const [reminderRecurrence, setReminderRecurrence] = useState<'once' | 'daily' | 'weekly'>('once');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const personId = getPersonId();

  const { toggle: toggleActionCompletion, toggledIds, loadingIds } = useOptimisticToggle<string>();

  useEffect(() => {
    async function load() {
      setLoading(true);
      setLoadError(null);
      if (!personId) {
        setLoadError('No care record is selected. Select an authorized care record to load your dashboard.');
        setLoading(false);
        return;
      }
      const results = await Promise.allSettled([
        getJSON(`/events/${encodeURIComponent(personId)}?limit=5`),
        getJSON(`/insights/${encodeURIComponent(personId)}?limit=3`),
        getJSON(`/observations/${encodeURIComponent(personId)}/trends`),
        getJSON(`/reasoning/${encodeURIComponent(personId)}/summary`),
        getJSON(`/daily-intelligence/${encodeURIComponent(personId)}`),
        getJSON(`/actions/${encodeURIComponent(personId)}`),
      ]);

      const [evts, inss, trendData, reasoningData, intelData, actionsData] = results;
      setEvents(evts.status === 'fulfilled' && Array.isArray(evts.value) ? evts.value as Event[] : []);
      setInsights(inss.status === 'fulfilled' && Array.isArray(inss.value) ? inss.value as Insight[] : []);
      setTrends(trendData.status === 'fulfilled' && Array.isArray(trendData.value) ? (trendData.value as ObservationTrend[]).slice(0, 5) : []);
      setReasoning(reasoningData.status === 'fulfilled' ? reasoningData.value as ReasoningSummary : null);
      setDailyIntel(intelData.status === 'fulfilled' ? intelData.value as DailyIntelligence : null);

      if (actionsData.status === 'fulfilled' && Array.isArray(actionsData.value)) {
        setActions((actionsData.value as Array<Record<string, unknown>>).map(action => ({
          id: String(action.id ?? ''),
          title: String(action.normalized_action || action.action_object || action.original_text || 'Untitled action'),
          description: typeof action.condition_text === 'string' ? action.condition_text : undefined,
          status: String(action.status ?? 'detected'),
          created_at: String(action.created_at ?? ''),
          is_medication_action: action.is_medication_action === true,
          requires_confirmation: action.requires_confirmation === true,
        })).filter(action => ['active', 'conditional', 'pending_confirmation', 'blocked'].includes(action.status)));
        setReminderActionId(previous => previous || (actionsData.value as Array<Record<string, unknown>>)
          .map(action => ({
            id: String(action.id ?? ''),
            status: String(action.status ?? 'detected'),
          }))
          .find(action => ['active', 'conditional'].includes(action.status))?.id || '');
      } else {
        setActions([]);
      }

      void Promise.all([
        getJSON(`/reminders/people/${encodeURIComponent(personId)}`),
        getJSON(`/reminders/people/${encodeURIComponent(personId)}/deliveries`),
      ]).then(([reminderData, deliveryData]) => {
        if (!Array.isArray(reminderData) || !Array.isArray(deliveryData)) {
          throw new Error('Reminder response was incomplete');
        }
        setReminders(reminderData as Reminder[]);
        setDeliveries(deliveryData as ReminderDelivery[]);
        setReminderError(null);
      }).catch(() => setReminderError('Reminders and delivery receipts could not be loaded. The service may be unavailable.'));

      const sectionNames = ['events', 'insights', 'observation trends', 'reasoning summary', 'daily intelligence', 'actions'];
      const failedSections = results
        .map((result, index) => {
          if (result.status === 'rejected') return sectionNames[index];
          const value = result.value;
          const expectsArray = index === 0 || index === 1 || index === 2 || index === 5;
          const validShape = expectsArray
            ? Array.isArray(value)
            : value !== null && typeof value === 'object' && !Array.isArray(value);
          return validShape ? null : sectionNames[index];
        })
        .filter((section): section is string => section !== null);
      setLoadError(failedSections.length
        ? `Some dashboard data could not be loaded: ${failedSections.join(', ')}. Check the API connection and try again.`
        : null);
      setLoading(false);
    }

    void load().catch(error => {
      console.error('Failed to load dashboard:', error);
      setLoadError('Dashboard data could not be loaded. Check the API connection and try again.');
      setLoading(false);
    });
  }, [personId]);

  const formatDate = (d: string) => {
    const date = new Date(d);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const handleActionToggle = async (actionId: string) => {
    const action = actions.find(item => item.id === actionId);
    if (!action || !['active', 'conditional'].includes(action.status)) return;
    const note = (completionNotes[actionId] || '').trim();
    if (!note) {
      setLoadError('Add a short completion note before marking this action complete.');
      return;
    }
    if (action.is_medication_action && action.requires_confirmation) {
      setLoadError('This medication-related action still requires confirmation. It cannot be marked complete yet.');
      return;
    }
    await toggleActionCompletion(actionId, {
      enableFn: async () => {
        await postJSON(`/actions/${actionId}/complete`, {
          evidence_ids: [],
          completion_confidence: 0.6,
          notes: note
        });
        
        setCompletionNotes(previous => ({ ...previous, [actionId]: '' }));
        setActions(prevActions =>
          prevActions.map(action =>
            action.id === actionId
              ? { ...action, status: 'completed' }
              : action
          )
        );
      },
      disableFn: async () => {
        // This would be for un-completing an action, but we don't allow that
        // In a real implementation, this might revert to active state
        throw new Error('Cannot un-complete an action');
      }
    });
  };


  const refreshReminders = async () => {
    if (!personId) {
      setReminderError('A valid care session is required to load reminders.');
      return;
    }
    try {
      const [reminderData, deliveryData] = await Promise.all([
        getJSON(`/reminders/people/${encodeURIComponent(personId)}`),
        getJSON(`/reminders/people/${encodeURIComponent(personId)}/deliveries`),
      ]);
      if (!Array.isArray(reminderData) || !Array.isArray(deliveryData)) throw new Error('Invalid reminder response');
      setReminders(reminderData as Reminder[]);
      setDeliveries(deliveryData as ReminderDelivery[]);
      setReminderError(null);
    } catch {
      setReminderError('Reminders could not be loaded. Try again when the service is available.');
    }
  };

  const createReminder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!personId || !reminderActionId) {
      setReminderError('Choose an active care action before scheduling a reminder.');
      return;
    }
    if (!reminderDueAt.trim()) {
      setReminderError('Choose a due date and time.');
      return;
    }
    const dueDate = new Date(reminderDueAt);
    if (Number.isNaN(dueDate.getTime())) {
      setReminderError('The due date and time are invalid.');
      return;
    }
    setReminderSaving(true);
    setReminderError(null);
    setReminderNotice(null);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const idempotencyKey = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `reminder-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const localTime = reminderDueAt.slice(11, 16);
      await postJSON(`/reminders/actions/${encodeURIComponent(reminderActionId)}`, {
        title: reminderTitle.trim(),
        message: reminderMessage.trim(),
        scheduled_at: dueDate.toISOString(),
        timezone,
        recurrence: reminderRecurrence,
        local_time: localTime,
        max_attempts: 5,
        retry_delay_seconds: 60,
      });
      setReminderTitle('');
      setReminderMessage('');
      setReminderDueAt('');
      setReminderRecurrence('once');
      setReminderNotice('Reminder saved. SolenOS will create a persistent in-app delivery receipt for each due occurrence.');
      await refreshReminders();
    } catch (error) {
      setReminderError(error instanceof Error ? error.message : 'Reminder could not be saved.');
    } finally {
      setReminderSaving(false);
    }
  };

  const cancelReminder = async (reminderId: string) => {
    if (!personId) {
      setReminderError('A valid care session is required to cancel a reminder.');
      return;
    }
    setReminderSaving(true);
    setReminderError(null);
    try {
      await deleteJSON(`/reminders/${encodeURIComponent(reminderId)}`);
      await refreshReminders();
      setReminderNotice('Reminder cancelled.');
    } catch (error) {
      setReminderError(error instanceof Error ? error.message : 'Reminder could not be cancelled.');
    } finally {
      setReminderSaving(false);
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '4px' }}>What matters today</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
        Quickly record changes, symptoms, behaviors, or observations from today.
      </p>

      <div style={{
        background: 'var(--trust-soft)', border: '1px solid var(--trust)',
        borderRadius: '8px', padding: '8px 14px', marginBottom: '16px'
      }}>
        <p style={{ fontSize: '12px', color: 'var(--trust)', marginBottom: '4px' }}>
          Today's changes are automatically added to the Living Care Record.
        </p>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <CareCapture personId={personId} />
      </div>

      {loadError && (
        <p role="alert" style={{ color: 'var(--warning)', fontSize: '13px', marginBottom: '16px' }}>
          {loadError}
        </p>
      )}

      {/* Action List Section: only render after a successful load. */}
      {!loading && !loadError && <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: '12px', padding: '16px 20px', marginBottom: '24px'
      }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px' }}>
          Active Actions
        </h2>
        {actions.length === 0 && (
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            No active actions. Actions will appear here when created from situations or insights.
          </p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {actions.map(action => (
            <div
              key={action.id}
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '16px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 600 }}>
                  {action.title}
                </h3>
                {action.description && (
                  <p style={{ margin: '0 0 4px 0', fontSize: '14px', color: 'var(--text-secondary)' }}>
                    {action.description}
                  </p>
                )}
                <p style={{ margin: '0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Created: {formatDate(action.created_at)} · Status: {action.status.replace(/_/g, ' ')}
                </p>
                {action.is_medication_action && action.requires_confirmation && (
                  <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--warning)' }}>
                    Medication source authority is unverified. This instruction cannot be activated or marked complete.
                  </p>
                )}
                {action.status === 'pending_confirmation' && !action.is_medication_action && (
                  <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    This action needs confirmation before it can be marked complete.
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  onClick={() => handleActionToggle(action.id)}
                  disabled={loadingIds.includes(action.id) || toggledIds.includes(action.id) || !['active', 'conditional'].includes(action.status) || (action.is_medication_action && action.requires_confirmation)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    background: toggledIds.includes(action.id)
                      ? 'var(--success)'
                      : 'var(--trust)',
                    color: 'white',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: loadingIds.includes(action.id) || toggledIds.includes(action.id)
                      ? 'default'
                      : 'pointer',
                    opacity: loadingIds.includes(action.id) ? 0.7 : 1
                  }}
                >
                  {loadingIds.includes(action.id) ? 'Processing...' : toggledIds.includes(action.id) ? 'Completed' : action.is_medication_action && action.requires_confirmation ? 'Awaiting verification' : !['active', 'conditional'].includes(action.status) ? 'Needs confirmation' : 'Mark Complete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>}


      <section aria-labelledby="reminders-heading" style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: '12px', padding: '16px 20px', marginBottom: '24px'
      }}>
        <h2 id="reminders-heading" style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
          Reminders and follow-through
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px' }}>
          Link a reminder to an active care action. Each due occurrence gets a persistent in-app delivery receipt and retry history.
        </p>
        {reminderError && <p role="alert" style={{ color: 'var(--warning)', fontSize: '13px', marginBottom: '12px' }}>{reminderError}</p>}
        {reminderNotice && <p role="status" style={{ color: 'var(--trust)', fontSize: '13px', marginBottom: '12px' }}>{reminderNotice}</p>}
        <form onSubmit={createReminder} style={{ display: 'grid', gap: '10px', marginBottom: '20px' }}>
          <label style={{ display: 'grid', gap: '4px', fontSize: '13px' }}>
            Related care action
            <select required value={reminderActionId} onChange={event => setReminderActionId(event.target.value)} style={{ padding: '10px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg)', color: 'inherit' }}>
              <option value="">Select an active action</option>
              {actions.filter(action => ['active', 'conditional'].includes(action.status) && !(action.is_medication_action && action.requires_confirmation)).map(action => (
                <option key={action.id} value={action.id}>{action.title}</option>
              ))}
            </select>
          </label>
          <label style={{ display: 'grid', gap: '4px', fontSize: '13px' }}>
            Reminder title
            <input required maxLength={200} value={reminderTitle} onChange={event => setReminderTitle(event.target.value)} placeholder="e.g. Call the clinic" style={{ padding: '10px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg)', color: 'inherit' }} />
          </label>
          <label style={{ display: 'grid', gap: '4px', fontSize: '13px' }}>
            Details
            <textarea required maxLength={4000} value={reminderMessage} onChange={event => setReminderMessage(event.target.value)} placeholder="What needs to happen?" rows={2} style={{ padding: '10px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg)', color: 'inherit' }} />
          </label>
          <label style={{ display: 'grid', gap: '4px', fontSize: '13px' }}>
            Date and time (your device's local time)
            <input required type="datetime-local" value={reminderDueAt} onChange={event => setReminderDueAt(event.target.value)} style={{ padding: '10px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg)', color: 'inherit' }} />
          </label>
          <label style={{ display: 'grid', gap: '4px', fontSize: '13px' }}>
            Repeat
            <select value={reminderRecurrence} onChange={event => setReminderRecurrence(event.target.value as 'once' | 'daily' | 'weekly')} style={{ padding: '10px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg)', color: 'inherit' }}>
              <option value="once">Does not repeat</option>
              <option value="daily">Every day</option>
              <option value="weekly">Every week</option>
            </select>
          </label>
          <div>
            <button type="submit" disabled={reminderSaving} style={{ padding: '10px 16px', borderRadius: '6px', border: 'none', background: 'var(--trust)', color: 'white', fontWeight: 600, cursor: reminderSaving ? 'wait' : 'pointer', opacity: reminderSaving ? 0.7 : 1 }}>
              {reminderSaving ? 'Saving…' : 'Save reminder'}
            </button>
          </div>
        </form>
        <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '10px' }}>Scheduled and past reminders</h3>
        {reminders.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>No reminders recorded yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {reminders.map(reminder => (
              <article key={reminder.id} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
                <div>
                  <h4 style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 600 }}>{reminder.title}</h4>
                  <p style={{ margin: '0 0 6px', fontSize: '13px', color: 'var(--text-secondary)' }}>{reminder.message}</p>
                  <p style={{ margin: '0 0 4px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {reminder.next_run_at ? new Date(reminder.next_run_at).toLocaleString() : 'No future occurrence'} · {reminder.timezone} · {reminder.recurrence === 'once' ? 'One-time' : `Repeats ${reminder.recurrence}`} at {reminder.local_time}
                  </p>
                  <p style={{ margin: 0, fontSize: '12px' }}>
                    Schedule: <strong>{reminder.enabled ? 'Enabled' : 'Paused'}</strong>
                  </p>
                  {deliveries.filter(delivery => delivery.reminder_id === reminder.id).slice(0, 3).map(delivery => (
                    <p key={delivery.id} style={{ margin: '5px 0 0', fontSize: '12px', color: delivery.status === 'failed' ? 'var(--warning)' : 'var(--text-secondary)' }}>
                      {new Date(delivery.scheduled_for).toLocaleString()}: <strong>{delivery.status}</strong> · attempts {delivery.attempt_count}
                      {delivery.delivered_at ? ` · delivered ${new Date(delivery.delivered_at).toLocaleString()}` : ''}
                      {delivery.last_error ? ` · ${delivery.last_error}` : ''}
                    </p>
                  ))}}
                </div>
                {reminder.enabled && (
                  <button type="button" disabled={reminderSaving} onClick={() => void cancelReminder(reminder.id)} style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'inherit', fontSize: '12px', cursor: reminderSaving ? 'wait' : 'pointer' }}>
                    Cancel
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <div style={{
        background: 'var(--accent-soft)', border: '1px solid var(--accent)',
        borderRadius: '8px', padding: '8px 14px', marginBottom: '24px'
      }}>
        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '2px' }}>
          ðŸ“š Living Care Record system model
        </p>
        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', opacity: 0.8 }}>
          Today's Change â†’ Living Care Record â†’ Timeline â†’ Insights â†’ Community Wisdom
        </p>
      </div>

      {loading && <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>}

      {!loading && !loadError ? (
        <div>
          {dailyIntel && (
            <section style={{ marginBottom: '40px' }}>
              <h2 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Daily summary
              </h2>
              <div style={{ 
                background: 'var(--surface)', border: '1px solid var(--border)', 
                borderRadius: '12px', padding: '16px 20px' 
              }}>
                <p style={{ fontSize: '14px', lineHeight: 1.6 }}>{dailyIntel.daily_summary}</p>
                {dailyIntel.overdue_items.length > 0 && (
                  <div style={{ marginTop: '12px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--unknown)', fontWeight: 500 }}>
                      {dailyIntel.overdue_items.length} overdue
                    </span>
                  </div>
                )}
                {dailyIntel.active_windows.length > 0 && (
                  <div style={{ marginTop: '8px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 500 }}>
                      {dailyIntel.active_windows.length} active monitoring period(s)
                    </span>
                  </div>
                )}
              </div>
            </section>
          )}

          <section style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Recent events
            </h2>
            {events.length === 0 && (
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                No events recorded yet.
              </p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {events.map(evt => (
                <div key={evt.id} style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: '12px', padding: '16px 20px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 500 }}>{evt.title}</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{formatDate(evt.occurred_at)}</span>
                  </div>
                  {evt.description && (
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{evt.description}</p>
                  )}
                  {evt.time_provenance && (
                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px', fontStyle: 'italic' }}>
                      Time source: {evt.time_provenance}
                    </p>
                  )}
                  {evt.location && (
                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      Location: {evt.location}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <Link to="/timeline" style={{ display: 'inline-block', marginTop: '16px', fontSize: '13px', color: 'var(--text-secondary)', textDecoration: 'none' }}>
              View full timeline â†’
            </Link>
          </section>

          {trends.length > 0 && (
            <section style={{ marginBottom: '40px' }}>
              <h2 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Observation patterns
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {trends.map(trend => (
                  <div key={trend.tag} style={{
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: '12px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}>
                    <div>
                      <span style={{ fontSize: '14px', fontWeight: 500, textTransform: 'capitalize' }}>{trend.tag.replace(/_/g, ' ')}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: '8px' }}>
                        {trend.count} observation{trend.count !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <span style={{
                      fontSize: '11px', padding: '2px 8px', borderRadius: '999px',
                      background: trend.trend === 'Strong pattern' ? 'var(--trust-soft)' : 'var(--unknown-soft)',
                      color: trend.trend === 'Strong pattern' ? 'var(--trust)' : 'var(--unknown)'
                    }}>
                      {trend.trend}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {reasoning && (
            <section style={{ marginBottom: '40px' }}>
              <h2 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                What the system knows
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {reasoning.confirmed_facts.length > 0 && (
                  <div style={{ background: 'var(--trust-soft)', borderRadius: '12px', padding: '16px 20px' }}>
                    <h3 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--trust)', marginBottom: '8px' }}>
                      Confirmed
                    </h3>
                    {reasoning.confirmed_facts.map((fact, i) => (
                      <p key={i} style={{ fontSize: '13px', color: 'var(--text)' }}>{fact.key}: {JSON.stringify(fact.value)}</p>
                    ))}
                  </div>
                )}
                {reasoning.open_questions.length > 0 && (
                  <div style={{ background: 'var(--unknown-soft)', borderRadius: '12px', padding: '16px 20px' }}>
                    <h3 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--unknown)', marginBottom: '8px' }}>
                      Open questions
                    </h3>
                    {reasoning.open_questions.map((q, i) => (
                      <p key={i} style={{ fontSize: '13px', color: 'var(--text)' }}>{q.key}: {JSON.stringify(q.value)}</p>
                    ))}
                  </div>
                )}
                {reasoning.preferences.length > 0 && (
                  <div style={{ background: 'var(--accent-soft)', borderRadius: '12px', padding: '16px 20px' }}>
                    <h3 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                      Preferences
                    </h3>
                    {reasoning.preferences.map((pref, i) => (
                      <p key={i} style={{ fontSize: '13px', color: 'var(--text)' }}>{pref.key}: {JSON.stringify(pref.value)}</p>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          <section>
            <h2 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Active insights
            </h2>
            {insights.length === 0 && (
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                No insights yet.
              </p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {insights.map(ins => (
                <div key={ins.id} style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: '12px', padding: '16px 20px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 500 }}>{ins.title}</span>
                    <span style={{ 
                      fontSize: '11px', padding: '2px 8px', borderRadius: '999px',
                      background: ins.confidence >= 0.8 ? 'var(--trust-soft)' : 'var(--unknown-soft)',
                      color: ins.confidence >= 0.8 ? 'var(--trust)' : 'var(--unknown)'
                    }}>
                      {Math.round(ins.confidence * 100)}% confidence
                    </span>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{ins.description}</p>
                  {ins.time_provenance && (
                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px', fontStyle: 'italic' }}>
                      Time source: {ins.time_provenance}
                    </p>
                  )}
                  {ins.possible_context && (
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px', fontStyle: 'italic' }}>
                      Possible context: {ins.possible_context}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <Link to="/insights" style={{ display: 'inline-block', marginTop: '16px', fontSize: '13px', color: 'var(--text-secondary)', textDecoration: 'none' }}>
              View all insights â†’
            </Link>
          </section>
        </div>
      ) : null}

        <div style={{ 
          display: 'flex', gap: '24px', padding: '16px 0', 
          borderTop: '1px solid var(--border)', fontSize: '13px', color: 'var(--text-secondary)' 
        }}>
          <Link to="/community" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Community wisdom</Link>
          <Link to="/record" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Living Care Record</Link>
          <Link to="/daily-care" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Daily care form</Link>
          <Link to="/login" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Role switch</Link>
        </div>
    </div>
  );
}