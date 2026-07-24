import { computeTrustStage } from "./trust-progression";
import { computeHabitHour, createDefaultUserState, createEventId } from "./prompts";
import type {
  ActivationEvent,
  ActivationEventType,
  ActivationUserState,
  DashboardActivationMetrics,
  RecordActivationEventInput,
  TrustStage,
  UserActivationMetrics,
} from "./types";

const events = new Map<string, ActivationEvent>();
const userStates = new Map<string, ActivationUserState>();
const entryHoursByUser = new Map<string, number[]>();

/** Apply a loaded state into the in-memory map (used after Postgres hydrate). */
export function hydrateUserState(state: ActivationUserState): void {
  userStates.set(state.user_id, state);
}

export function getOrCreateUserState(userId: string): ActivationUserState {
  const existing = userStates.get(userId);
  if (existing) return existing;
  const state = createDefaultUserState(userId);
  userStates.set(userId, state);
  return state;
}

export function getUserState(userId: string): ActivationUserState | undefined {
  return userStates.get(userId);
}

function trackEntryHour(userId: string, createdAt: string): void {
  const hour = new Date(createdAt).getHours();
  const hours = entryHoursByUser.get(userId) ?? [];
  hours.push(hour);
  entryHoursByUser.set(userId, hours.slice(-50));
}

function applyEntrySideEffects(
  state: ActivationUserState,
  eventType: ActivationEventType,
  createdAt: string,
): ActivationUserState {
  if (eventType === "ENTRY_CREATED" || eventType === "VOICE_ENTRY_CREATED") {
    trackEntryHour(state.user_id, createdAt);
    const habitHour = computeHabitHour(entryHoursByUser.get(state.user_id) ?? []);
    const totalEntries = state.total_entries + 1;
    return {
      ...state,
      total_entries: totalEntries,
      first_entry_at: state.first_entry_at ?? createdAt,
      last_entry_at: createdAt,
      voice_entry_count:
        eventType === "VOICE_ENTRY_CREATED"
          ? state.voice_entry_count + 1
          : state.voice_entry_count,
      trust_stage: computeTrustStage(totalEntries),
      habit_hour: habitHour,
      updated_at: createdAt,
    };
  }

  if (eventType === "DOCUMENT_UPLOADED") {
    return {
      ...state,
      document_entry_count: state.document_entry_count + 1,
      updated_at: createdAt,
    };
  }

  return { ...state, updated_at: createdAt };
}

export function recordActivationEvent(input: RecordActivationEventInput): {
  event: ActivationEvent;
  state: ActivationUserState;
} {
  const createdAt = input.created_at ?? new Date().toISOString();
  const event: ActivationEvent = {
    id: createEventId(),
    user_id: input.user_id,
    event_type: input.event_type,
    payload: input.payload ?? {},
    created_at: createdAt,
  };

  events.set(event.id, event);

  let state = getOrCreateUserState(input.user_id);
  state = applyEntrySideEffects(state, input.event_type, createdAt);
  userStates.set(input.user_id, state);

  return { event, state };
}

export function listEventsForUser(userId: string): ActivationEvent[] {
  return [...events.values()]
    .filter((e) => e.user_id === userId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function computeUserMetrics(userId: string): UserActivationMetrics {
  const state = getOrCreateUserState(userId);
  const userEvents = listEventsForUser(userId);
  const entryEvents = userEvents.filter(
    (e) => e.event_type === "ENTRY_CREATED" || e.event_type === "VOICE_ENTRY_CREATED",
  );

  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const monthMs = 30 * 24 * 60 * 60 * 1000;

  const entriesPerWeek = entryEvents.filter(
    (e) => now - new Date(e.created_at).getTime() <= weekMs,
  ).length;

  const entriesPerMonth = entryEvents.filter(
    (e) => now - new Date(e.created_at).getTime() <= monthMs,
  ).length;

  let daysBetweenEntries: number | null = null;
  if (entryEvents.length >= 2) {
    const first = new Date(entryEvents[0]!.created_at).getTime();
    const last = new Date(entryEvents[entryEvents.length - 1]!.created_at).getTime();
    daysBetweenEntries = Math.round((last - first) / (1000 * 60 * 60 * 24) / (entryEvents.length - 1));
  }

  const totalEntries = Math.max(state.total_entries, 1);
  const voiceRate = state.voice_entry_count / totalEntries;
  const documentRate = state.document_entry_count / totalEntries;

  const firstEntryAt = state.first_entry_at ? new Date(state.first_entry_at).getTime() : null;

  function retentionWeek(week: number): boolean | null {
    if (!firstEntryAt) return null;
    const target = firstEntryAt + week * weekMs;
    if (Date.now() < target) return null;
    return entryEvents.some((e) => {
      const t = new Date(e.created_at).getTime();
      return t >= firstEntryAt + (week - 1) * weekMs && t <= firstEntryAt + week * weekMs;
    });
  }

  return {
    entries_per_week: entriesPerWeek,
    entries_per_month: entriesPerMonth,
    days_between_entries: daysBetweenEntries,
    voice_usage_rate: voiceRate,
    document_usage_rate: documentRate,
    week1_retention: retentionWeek(1),
    week4_retention: retentionWeek(4),
    week8_retention: retentionWeek(8),
    trust_stage: state.trust_stage,
  };
}

export function computeDashboardMetrics(): DashboardActivationMetrics {
  const allStates = [...userStates.values()];
  const allEvents = [...events.values()];
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const weekMs = 7 * dayMs;

  const dailyActive = new Set<string>();
  const weeklyActive = new Set<string>();

  for (const event of allEvents) {
    const age = now - new Date(event.created_at).getTime();
    if (age <= dayMs) dailyActive.add(event.user_id);
    if (age <= weekMs) weeklyActive.add(event.user_id);
  }

  const trustDist: Record<TrustStage, number> = {
    early: 0,
    building: 0,
    established: 0,
  };
  for (const state of allStates) {
    trustDist[state.trust_stage] += 1;
  }

  const totalEntries = allStates.reduce((sum, s) => sum + s.total_entries, 0);
  const avgEntries = allStates.length > 0 ? totalEntries / allStates.length : 0;

  const returnSessions = allEvents.filter((e) => e.event_type === "RETURN_SESSION").length;
  const returnRate = allStates.length > 0 ? returnSessions / allStates.length : 0;

  return {
    daily_active_users: dailyActive.size,
    weekly_active_users: weeklyActive.size,
    average_entries_per_user: avgEntries,
    return_rate: returnRate,
    trust_stage_distribution: trustDist,
    total_events: allEvents.length,
  };
}

export function resetActivationStoreForTests(): void {
  events.clear();
  userStates.clear();
  entryHoursByUser.clear();
}
