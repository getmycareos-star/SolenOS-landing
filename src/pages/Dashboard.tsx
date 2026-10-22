import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getJSON, postJSON, getPersonId, subscribeToPersonId } from '../api/client';
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
  status: 'active' | 'completed';
  created_at: string;
}

export default function Dashboard() {
  const [events, setEvents] = useState<Event[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [trends, setTrends] = useState<ObservationTrend[]>([]);
  const [reasoning, setReasoning] = useState<ReasoningSummary | null>(null);
  const [dailyIntel, setDailyIntel] = useState<DailyIntelligence | null>(null);
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const { toggle: toggleActionCompletion, toggledIds, loadingIds } = useOptimisticToggle<string>();

  const [personId, setPersonIdState] = useState(getPersonId());

  useEffect(() => subscribeToPersonId(setPersonIdState), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);
      setEvents([]);
      setInsights([]);
      setTrends([]);
      setReasoning(null);
      setDailyIntel(null);
      setActions([]);

      if (!personId.trim()) {
        setLoadError('Select an authorized care record before loading dashboard information.');
        setLoading(false);
        return;
      }

      try {
        const encodedPersonId = encodeURIComponent(personId);
        const results = await Promise.allSettled([
          getJSON(`/events/${encodedPersonId}?limit=5`),
          getJSON(`/insights/${encodedPersonId}?limit=3`),
          getJSON(`/observations/${encodedPersonId}/trends`),
          getJSON(`/reasoning/${encodedPersonId}/summary`),
          getJSON(`/daily-intelligence/${encodedPersonId}`),
          getJSON(`/actions/${encodedPersonId}?status=active`),
        ]);

        const names = ['events', 'insights', 'observation trends', 'reasoning summary', 'daily intelligence', 'actions'];
        const failures = results
          .map((result, index) => result.status === 'rejected' ? names[index] : null)
          .filter((name): name is string => name !== null);
        if (failures.length) {
          throw new Error(`Dashboard data could not be loaded for: ${failures.join(', ')}. No empty state is being inferred from failed requests.`);
        }

        const values = results.map(result => (result as PromiseFulfilledResult<unknown>).value);
        const isRecord = (value: unknown): value is Record<string, unknown> =>
          Boolean(value && typeof value === 'object' && !Array.isArray(value));
        const validEvents = Array.isArray(values[0]) && values[0].every((item: unknown) =>
          isRecord(item) && typeof item.id === 'string' && Boolean(item.id) &&
          typeof item.title === 'string' &&
          typeof item.occurred_at === 'string' && Number.isFinite(new Date(item.occurred_at).getTime())
        );
        const validInsights = Array.isArray(values[1]) && values[1].every((item: unknown) =>
          isRecord(item) && typeof item.id === 'string' && Boolean(item.id) &&
          typeof item.title === 'string' && typeof item.description === 'string' &&
          typeof item.insight_type === 'string' &&
          typeof item.confidence === 'number' && Number.isFinite(item.confidence)
        );
        const validTrends = Array.isArray(values[2]) && values[2].every((item: unknown) =>
          isRecord(item) && typeof item.tag === 'string' &&
          typeof item.count === 'number' && Number.isFinite(item.count) &&
          typeof item.trend === 'string'
        );
        const reasoningValue = values[3];
        const dailyIntelValue = values[4];
        const reasoningKeys = ['confirmed_facts', 'open_questions', 'preferences', 'rejected_assumptions', 'care_patterns', 'coordination_decisions'];
        const validReasoning = isRecord(reasoningValue) && reasoningKeys.every(key => Array.isArray(reasoningValue[key]));
        const validDailyIntel = dailyIntelValue === null || (
          isRecord(dailyIntelValue) &&
          typeof dailyIntelValue.daily_summary === 'string' &&
          ['overdue_items', 'upcoming_items', 'active_windows', 'expired_windows'].every(key => Array.isArray(dailyIntelValue[key]))
        );
        if (!validEvents || !validInsights || !validTrends || !validReasoning || !validDailyIntel || !Array.isArray(values[5])) {
          throw new Error('The server returned incomplete dashboard data. No missing fields or empty states were guessed.');
        }

        const nextActions = (values[5] as Array<Record<string, unknown>>).map(action => {
          const title = action.normalized_action || action.action_object || action.original_text;
          if (
            typeof action.id !== 'string' || !action.id ||
            typeof title !== 'string' || !title.trim() ||
            !['active', 'completed'].includes(String(action.status)) ||
            typeof action.created_at !== 'string' ||
            !Number.isFinite(new Date(action.created_at).getTime())
          ) {
            throw new Error('The server returned an action without a valid ID or description. The dashboard data was not treated as complete.');
          }
          return {
            id: action.id,
            title,
            description: typeof action.condition_text === 'string' ? action.condition_text : undefined,
            status: action.status as 'active' | 'completed',
            created_at: action.created_at as string,
          };
        });

        if (cancelled) return;
        setEvents(values[0] as Event[]);
        setInsights(values[1] as Insight[]);
        setTrends((values[2] as ObservationTrend[]).slice(0, 5));
        setReasoning(values[3] as ReasoningSummary | null);
        setDailyIntel(values[4] as DailyIntelligence | null);
        setActions(nextActions);
      } catch (error) {
        if (cancelled) return;
        setEvents([]);
        setInsights([]);
        setTrends([]);
        setReasoning(null);
        setDailyIntel(null);
        setActions([]);
        setLoadError(error instanceof Error ? error.message : 'Dashboard data could not be verified. Its contents are unknown.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
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
    await toggleActionCompletion(actionId, {
      enableFn: async () => {
        // Mark action as complete
        await postJSON(`/actions/${actionId}/complete`, {
          evidence_ids: [],
          completion_confidence: 0,
          notes: 'Marked complete by the caregiver in the dashboard; no supporting evidence was attached.'
        });
        
        // Update local state optimistically (handled by hook)
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
          A care update is added to the Living Care Record only after the server confirms it was saved.
        </p>
        <p style={{ fontSize: '11px', color: 'var(--trust)', opacity: 0.8 }}>
          Use your own observations; no care event is prefilled.
        </p>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <CareCapture personId={getPersonId()} />
      </div>

      {loadError && (
        <p role="alert" style={{ color: 'var(--warning)', fontSize: '13px', marginBottom: '16px' }}>
          {loadError}
        </p>
      )}

      {/* Action List Section */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: '12px', padding: '16px 20px', marginBottom: '24px'
      }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px' }}>
          Active Actions
        </h2>
        {!loadError && actions.length === 0 && (
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
                  Created: {formatDate(action.created_at)}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  onClick={() => handleActionToggle(action.id)}
                  disabled={loadingIds.includes(action.id)}
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
                  {loadingIds.includes(action.id) ? 'Processing...' : toggledIds.includes(action.id) ? 'Completed' : 'Mark Complete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

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
          <Link to="/appointments" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Appointments</Link>
          <Link to="/care-circle" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Care coordination</Link>
          <Link to="/login" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Role switch</Link>
        </div>
    </div>
  );
}