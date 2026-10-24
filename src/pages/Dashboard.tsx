import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { getJSON, postJSON, patchJSON, deleteJSON, getPersonId, getCaregiverId } from '../api/client';
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
  overdue_items: Array<Record<string, unknown>>;
  upcoming_items: Array<Record<string, unknown>>;
  active_windows: any[];
  expired_windows: any[];
  daily_summary: string;
}

interface Appointment {
  id: string;
  title: string;
  scheduled_at: string;
  status: string;
  location?: string;
  provider?: string;
  preparation_notes?: string;
  documents_to_bring?: string[];
  medication_questions?: string[];
}

interface Action {
  id: string;
  title: string;
  description?: string;
  status: string;
  created_at: string;
  deadline?: string | null;
  is_medication_action?: boolean;
  requires_confirmation?: boolean;
  actor_id?: string | null;
  actor_label?: string | null;
}

interface LinkedCaregiver {
  id: string;
  name: string;
  relationship?: string;
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

interface ReminderDeliveryAttempt {
  id: string;
  delivery_id: string;
  attempt_number: number;
  channel: string;
  started_at: string;
  finished_at?: string | null;
  outcome: string;
  error_type?: string | null;
}

export default function Dashboard() {
  const [events, setEvents] = useState<Event[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [trends, setTrends] = useState<ObservationTrend[]>([]);
  const [reasoning, setReasoning] = useState<ReasoningSummary | null>(null);
  const [dailyIntel, setDailyIntel] = useState<DailyIntelligence | null>(null);
  const [actions, setActions] = useState<Action[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [linkedCaregivers, setLinkedCaregivers] = useState<LinkedCaregiver[]>([]);
  const [assignmentLoadingIds, setAssignmentLoadingIds] = useState<string[]>([]);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [deliveries, setDeliveries] = useState<ReminderDelivery[]>([]);
  const [deliveryAttempts, setDeliveryAttempts] = useState<Record<string, ReminderDeliveryAttempt[]>>({});
  const [expandedDeliveryId, setExpandedDeliveryId] = useState<string | null>(null);
  const [attemptLoadingId, setAttemptLoadingId] = useState<string | null>(null);
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
  const [captureRevision, setCaptureRevision] = useState(0);
  const personId = getPersonId();

  const { toggle: toggleActionCompletion, toggledIds, loadingIds } = useOptimisticToggle<string>();

  useEffect(() => {
    setLinkedCaregivers([]);
    setAssignmentError(null);
    if (!personId) return;
    void getJSON(`/caregivers/${encodeURIComponent(personId)}`)
      .then(data => {
        if (!Array.isArray(data)) throw new Error('Caregiver list response was incomplete.');
        setLinkedCaregivers(data as LinkedCaregiver[]);
      })
      .catch(error => {
        console.error('Failed to load linked caregivers:', error);
        setAssignmentError('Linked caregivers could not be loaded; task assignments are unavailable until the connection is restored.');
      });
  }, [personId]);

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
        getJSON(`/appointments/${encodeURIComponent(personId)}`),
      ]);

      const [evts, inss, trendData, reasoningData, intelData, actionsData, appointmentsData] = results;
      setEvents(evts.status === 'fulfilled' && Array.isArray(evts.value) ? evts.value as Event[] : []);
      setInsights(inss.status === 'fulfilled' && Array.isArray(inss.value) ? inss.value as Insight[] : []);
      setTrends(trendData.status === 'fulfilled' && Array.isArray(trendData.value) ? (trendData.value as ObservationTrend[]).slice(0, 5) : []);
      setReasoning(reasoningData.status === 'fulfilled' ? reasoningData.value as ReasoningSummary : null);
      setDailyIntel(intelData.status === 'fulfilled' ? intelData.value as DailyIntelligence : null);

      setAppointments(appointmentsData.status === 'fulfilled' && Array.isArray(appointmentsData.value)
        ? appointmentsData.value as Appointment[]
        : []);

      if (actionsData.status === 'fulfilled' && Array.isArray(actionsData.value)) {
        setActions((actionsData.value as Array<Record<string, unknown>>).map(action => ({
          id: String(action.id ?? ''),
          title: String(action.normalized_action || action.action_object || action.original_text || 'Untitled action'),
          description: typeof action.condition_text === 'string' ? action.condition_text : undefined,
          status: String(action.status ?? 'detected'),
          created_at: String(action.created_at ?? ''),
          deadline: typeof action.deadline === 'string' ? action.deadline : null,
          is_medication_action: action.is_medication_action === true,
          requires_confirmation: action.requires_confirmation === true,
          actor_id: typeof action.actor_id === 'string' ? action.actor_id : null,
          actor_label: typeof action.actor_label === 'string' ? action.actor_label : null,
        })).filter(action => ['active', 'conditional', 'pending_confirmation', 'blocked'].includes(action.status)));
        const eligibleReminderActions = (actionsData.value as Array<Record<string, unknown>>)
          .map(action => ({ id: String(action.id ?? ''), status: String(action.status ?? 'detected') }))
          .filter(action => ['active', 'conditional'].includes(action.status));
        setReminderActionId(previous => eligibleReminderActions.some(action => action.id === previous)
          ? previous
          : eligibleReminderActions[0]?.id || '');
      } else {
        setActions([]);
      }

      const sectionNames = ['events', 'insights', 'observation trends', 'reasoning summary', 'daily intelligence', 'actions', 'appointments'];
      const failedSections = results
        .map((result, index) => {
          if (result.status === 'rejected') return sectionNames[index];
          const value = result.value;
          const expectsArray = index === 0 || index === 1 || index === 2 || index === 5 || index === 6;
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
  }, [personId, captureRevision]);

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

  const handleAssignAction = async (actionId: string, caregiverId: string) => {
    setAssignmentLoadingIds(previous => [...previous, actionId]);
    setAssignmentError(null);
    try {
      const updated = await patchJSON(`/actions/${encodeURIComponent(actionId)}`, { actor_id: caregiverId || null }) as { actor_id?: string | null; actor_label?: string | null };
      setActions(previous => previous.map(action => action.id === actionId
        ? { ...action, actor_id: updated.actor_id ?? null, actor_label: updated.actor_label ?? null }
        : action));
    } catch (error) {
      console.error('Failed to assign action:', error);
      setAssignmentError(error instanceof Error ? error.message : 'Task assignment failed. Try again.');
    } finally {
      setAssignmentLoadingIds(previous => previous.filter(id => id !== actionId));
    }
  };

  const handleActionToggle = async (actionId: string) => {
    const action = actions.find(item => item.id === actionId);
    if (!action || !['active', 'conditional'].includes(action.status)) return;
    const note = (completionNotes[actionId] || '').trim();
    if (!note) throw new Error('Add a short completion note before marking this action complete.');
    if (action.is_medication_action && action.requires_confirmation) {
      throw new Error('This medication-related action still requires confirmation.');
    }
    await toggleActionCompletion(actionId, {
      enableFn: async () => {
        if (!personId || !getCaregiverId()) throw new Error('A valid care session is required to record completion.');
        await postJSON(`/actions/${actionId}/complete`, {
          evidence_ids: [],
          completion_confidence: 0.6,
          notes: note,
        });
        setCompletionNotes(previous => ({ ...previous, [actionId]: '' }));
        setActions(prevActions => prevActions.map(item => item.id === actionId ? { ...item, status: 'completed' } : item));
        setReminderActionId(previous => previous === actionId
          ? actions.find(item => item.id !== actionId && ['active', 'conditional'].includes(item.status))?.id || ''
          : previous);
      },
      disableFn: async () => {
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
      setReminderError('Reminders and delivery receipts could not be loaded. Try again when the service is available.');
    }
  };

  useEffect(() => {
    void refreshReminders();
    // The care record is the only scope; the API derives caregiver identity from its bearer session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personId]);

  const createReminder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!personId || !reminderActionId) {
      setReminderError('Choose an active care action before scheduling a reminder.');
      return;
    }
    const dueDate = new Date(reminderDueAt);
    if (!reminderDueAt.trim() || Number.isNaN(dueDate.getTime())) {
      setReminderError('Choose a valid due date and time.');
      return;
    }
    setReminderSaving(true);
    setReminderError(null);
    setReminderNotice(null);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      await postJSON(`/reminders/actions/${encodeURIComponent(reminderActionId)}`, {
        title: reminderTitle.trim(),
        message: reminderMessage.trim(),
        scheduled_at: dueDate.toISOString(),
        timezone,
        recurrence: reminderRecurrence,
        local_time: reminderDueAt.slice(11, 16),
        max_attempts: 5,
        retry_delay_seconds: 60,
      });
      setReminderTitle('');
      setReminderMessage('');
      setReminderDueAt('');
      setReminderRecurrence('once');
      setReminderNotice('Reminder saved. Each due occurrence receives a persistent in-app delivery receipt and attempt history.');
      await refreshReminders();
    } catch (error) {
      setReminderError(error instanceof Error ? error.message : 'Reminder could not be saved.');
    } finally {
      setReminderSaving(false);
    }
  };


  const toggleDeliveryAttempts = async (reminderId: string, deliveryId: string) => {
    if (expandedDeliveryId === deliveryId) {
      setExpandedDeliveryId(null);
      return;
    }
    setExpandedDeliveryId(deliveryId);
    if (deliveryAttempts[deliveryId]) return;
    setAttemptLoadingId(deliveryId);
    try {
      const data = await getJSON(`/reminders/${encodeURIComponent(reminderId)}/deliveries/${encodeURIComponent(deliveryId)}/attempts`);
      if (!Array.isArray(data)) throw new Error('Delivery attempt history was incomplete');
      setDeliveryAttempts(previous => ({ ...previous, [deliveryId]: data as ReminderDeliveryAttempt[] }));
    } catch (error) {
      setReminderError(error instanceof Error ? error.message : 'Delivery attempt history could not be loaded.');
    } finally {
      setAttemptLoadingId(null);
    }
  };

  const cancelReminder = async (reminderId: string) => {
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
        <CareCapture
          personId={personId}
          onCapture={() => setCaptureRevision((revision) => revision + 1)}
        />
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
        <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '12px' }}>
          Assign each action to a caregiver already linked to this care record. Only authorized linked caregivers are offered.
        </p>
        {assignmentError && <p role="alert" style={{ color: 'var(--unknown)', fontSize: '12px', marginBottom: '12px' }}>{assignmentError}</p>}
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
                  Recorded: {formatDate(action.created_at)}
                </p>
                {action.deadline && Number.isFinite(Date.parse(action.deadline)) && (
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: Date.parse(action.deadline) < Date.now() ? 'var(--unknown)' : 'var(--text-secondary)', fontWeight: Date.parse(action.deadline) < Date.now() ? 600 : 400 }}>
                    {Date.parse(action.deadline) < Date.now() ? 'Overdue · ' : 'Due · '}{new Date(action.deadline).toLocaleString()}
                  </p>
                )}
                {action.is_medication_action && action.requires_confirmation && (
                  <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--warning)' }}>
                    Medication source authority still requires verification. This action cannot be completed or scheduled yet.
                  </p>
                )}
                {['active', 'conditional'].includes(action.status) && (
                  <label style={{ display: 'grid', gap: '4px', marginTop: '10px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Completion note (required)
                    <textarea value={completionNotes[action.id] || ''} onChange={event => setCompletionNotes(previous => ({ ...previous, [action.id]: event.target.value }))} placeholder="What did you do, and what happened?" rows={2} maxLength={2000} style={{ padding: '8px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--surface)', color: 'inherit', width: '100%' }} />
                  </label>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {linkedCaregivers.length > 0 && (
                  <select
                    aria-label={`Assign ${action.title} to a caregiver`}
                    value={action.actor_id || ''}
                    disabled={assignmentLoadingIds.includes(action.id)}
                    onChange={event => handleAssignAction(action.id, event.target.value)}
                    style={{ maxWidth: '190px', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '12px' }}
                  >
                    <option value="">Unassigned</option>
                    {linkedCaregivers.map(caregiver => <option key={caregiver.id} value={caregiver.id}>{caregiver.name}{caregiver.relationship ? ` · ${caregiver.relationship}` : ''}</option>)}
                  </select>
                )}
                <button
                  onClick={() => void handleActionToggle(action.id).catch(error => setLoadError(error instanceof Error ? error.message : 'Completion could not be saved.'))}
                  disabled={loadingIds.includes(action.id) || toggledIds.includes(action.id) || !['active', 'conditional'].includes(action.status) || !(completionNotes[action.id] || '').trim() || (action.is_medication_action && action.requires_confirmation)}
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
        <h2 id="reminders-heading" style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>Reminders and follow-through</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px' }}>
          Link a reminder to an active care action. Each due occurrence receives a persistent in-app receipt and retry history.
        </p>
        {reminderError && <p role="alert" style={{ color: 'var(--warning)', fontSize: '13px', marginBottom: '12px' }}>{reminderError}</p>}
        {reminderNotice && <p role="status" style={{ color: 'var(--trust)', fontSize: '13px', marginBottom: '12px' }}>{reminderNotice}</p>}
        <form onSubmit={createReminder} style={{ display: 'grid', gap: '10px', marginBottom: '20px' }}>
          <label style={{ display: 'grid', gap: '4px', fontSize: '13px' }}>
            Related care action
            <select required value={reminderActionId} onChange={event => setReminderActionId(event.target.value)} style={{ padding: '10px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg)', color: 'inherit' }}>
              <option value="">Select an active action</option>
              {actions.filter(action => ['active', 'conditional'].includes(action.status) && !(action.is_medication_action && action.requires_confirmation)).map(action => <option key={action.id} value={action.id}>{action.title}</option>)}
            </select>
          </label>
          <label style={{ display: 'grid', gap: '4px', fontSize: '13px' }}>Reminder title
            <input required maxLength={180} value={reminderTitle} onChange={event => setReminderTitle(event.target.value)} placeholder="e.g. Call the clinic" style={{ padding: '10px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg)', color: 'inherit' }} />
          </label>
          <label style={{ display: 'grid', gap: '4px', fontSize: '13px' }}>Details
            <textarea required maxLength={2000} value={reminderMessage} onChange={event => setReminderMessage(event.target.value)} placeholder="What needs to happen?" rows={2} style={{ padding: '10px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg)', color: 'inherit' }} />
          </label>
          <label style={{ display: 'grid', gap: '4px', fontSize: '13px' }}>Date and time (device local time)
            <input required type="datetime-local" value={reminderDueAt} onChange={event => setReminderDueAt(event.target.value)} style={{ padding: '10px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg)', color: 'inherit' }} />
          </label>
          <label style={{ display: 'grid', gap: '4px', fontSize: '13px' }}>Repeat
            <select value={reminderRecurrence} onChange={event => setReminderRecurrence(event.target.value as 'once' | 'daily' | 'weekly')} style={{ padding: '10px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg)', color: 'inherit' }}>
              <option value="once">Does not repeat</option><option value="daily">Every day</option><option value="weekly">Every week</option>
            </select>
          </label>
          <div><button type="submit" disabled={reminderSaving || !reminderActionId} style={{ padding: '10px 16px', borderRadius: '6px', border: 'none', background: 'var(--trust)', color: 'white', fontWeight: 600, cursor: reminderSaving ? 'wait' : 'pointer', opacity: reminderSaving ? 0.7 : 1 }}>{reminderSaving ? 'Saving…' : 'Save reminder'}</button></div>
        </form>
        <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '10px' }}>Scheduled reminders and delivery receipts</h3>
        {reminders.length === 0 ? <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>No reminders recorded yet.</p> : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {reminders.map(reminder => (
              <article key={reminder.id} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
                <div>
                  <h4 style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 600 }}>{reminder.title}</h4>
                  <p style={{ margin: '0 0 6px', fontSize: '13px', color: 'var(--text-secondary)' }}>{reminder.message}</p>
                  <p style={{ margin: '0 0 4px', fontSize: '12px', color: 'var(--text-secondary)' }}>{reminder.enabled && reminder.next_run_at ? new Date(reminder.next_run_at).toLocaleString() : 'No future occurrence'} · {reminder.timezone} · {reminder.recurrence === 'once' ? 'One-time' : `Repeats ${reminder.recurrence}`} at {reminder.local_time}</p>
                  <p style={{ margin: 0, fontSize: '12px' }}>Schedule: <strong>{reminder.enabled ? 'Enabled' : 'Paused'}</strong></p>
                  {deliveries.filter(delivery => delivery.reminder_id === reminder.id).slice(0, 3).map(delivery => (
                    <div key={delivery.id} style={{ marginTop: '6px', fontSize: '12px' }}>
                      <p style={{ margin: '5px 0 0', color: delivery.status === 'failed' ? 'var(--warning)' : 'var(--text-secondary)' }}>
                        {new Date(delivery.scheduled_for).toLocaleString()}: <strong>{delivery.status}</strong> · attempts {delivery.attempt_count}
                        {delivery.delivered_at ? ` · delivered ${new Date(delivery.delivered_at).toLocaleString()}` : ''}
                        {delivery.last_error ? ` · ${delivery.last_error}` : ''}
                      </p>
                      <button type="button" onClick={() => void toggleDeliveryAttempts(reminder.id, delivery.id)} style={{ marginTop: '4px', padding: '3px 6px', border: '1px solid var(--border)', borderRadius: '4px', background: 'transparent', color: 'inherit', fontSize: '11px' }}>
                        {expandedDeliveryId === delivery.id ? 'Hide attempt history' : 'View attempt history'}
                      </button>
                      {expandedDeliveryId === delivery.id && (
                        <ul style={{ margin: '4px 0 0', paddingLeft: '18px', color: 'var(--text-secondary)' }}>
                          {attemptLoadingId === delivery.id ? <li>Loading attempts…</li> : (deliveryAttempts[delivery.id] || []).map(attempt => (
                            <li key={attempt.id}>
                              Attempt {attempt.attempt_number}: {attempt.outcome} via {attempt.channel}
                              {attempt.started_at ? ` · ${new Date(attempt.started_at).toLocaleString()}` : ''}
                              {attempt.error_type ? ` · ${attempt.error_type}` : ''}
                            </li>
                          ))}
                          {!attemptLoadingId && (deliveryAttempts[delivery.id] || []).length === 0 && <li>No attempt details recorded.</li>}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
                {reminder.enabled && <button type="button" disabled={reminderSaving} onClick={() => void cancelReminder(reminder.id)} style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'inherit', fontSize: '12px', cursor: reminderSaving ? 'wait' : 'pointer' }}>Cancel</button>}
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
                    <ul style={{ margin: '8px 0 0', paddingLeft: '20px' }}>
                      {dailyIntel.overdue_items.map((item, index) => (
                        <li key={`${String(item.type ?? 'item')}-${index}`} style={{ fontSize: '13px', marginBottom: '6px' }}>
                          <strong>{String(item.title || 'Untitled item')}</strong>
                          {item.scheduled_at ? ` — scheduled ${new Date(String(item.scheduled_at)).toLocaleString()}` : ''}
                          {item.location ? ` · ${String(item.location)}` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {dailyIntel.upcoming_items.length > 0 && (
                  <div style={{ marginTop: '12px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 500 }}>Items today</span>
                    <ul style={{ margin: '8px 0 0', paddingLeft: '20px' }}>
                      {dailyIntel.upcoming_items.map((item, index) => (
                        <li key={`${String(item.type ?? 'item')}-${index}`} style={{ fontSize: '13px', marginBottom: '6px' }}>
                          <strong>{String(item.title || 'Untitled item')}</strong>
                          {(item.scheduled_at || item.occurred_at) ? ` — ${new Date(String(item.scheduled_at || item.occurred_at)).toLocaleString()}` : ''}
                          {item.location ? ` · ${String(item.location)}` : ''}
                        </li>
                      ))}
                    </ul>
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
              Upcoming appointments
            </h2>
            {appointments.filter(appointment => ['scheduled', 'upcoming', 'today'].includes(appointment.status) && Number.isFinite(Date.parse(appointment.scheduled_at)) && Date.parse(appointment.scheduled_at) >= Date.now() - 24 * 60 * 60 * 1000).length === 0 && (
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>No upcoming appointments are recorded. This does not mean no appointment exists outside SolenOS.</p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {appointments
                .filter(appointment => ['scheduled', 'upcoming', 'today'].includes(appointment.status) && Number.isFinite(Date.parse(appointment.scheduled_at)) && Date.parse(appointment.scheduled_at) >= Date.now() - 24 * 60 * 60 * 1000)
                .sort((a, b) => Date.parse(a.scheduled_at) - Date.parse(b.scheduled_at))
                .slice(0, 5)
                .map(appointment => (
                  <div key={appointment.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '14px' }}>{appointment.title}</strong>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{new Date(appointment.scheduled_at).toLocaleString()}</span>
                    </div>
                    {(appointment.provider || appointment.location) && <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px' }}>{[appointment.provider, appointment.location].filter(Boolean).join(' · ')}</p>}
                    {appointment.preparation_notes && <p style={{ fontSize: '13px', marginTop: '8px' }}>Preparation: {appointment.preparation_notes}</p>}
                    {Array.isArray(appointment.documents_to_bring) && appointment.documents_to_bring.length > 0 && <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>Bring: {appointment.documents_to_bring.join(', ')}</p>}
                    {Array.isArray(appointment.medication_questions) && appointment.medication_questions.length > 0 && <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>Questions to ask: {appointment.medication_questions.join('; ')}</p>}
                  </div>
                ))}
            </div>
          </section>

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