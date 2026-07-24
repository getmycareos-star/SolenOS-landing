import type { SessionSnapshot } from "./types";

const sessions = new Map<string, SessionSnapshot>();

export function getLastSessionSnapshot(caregiverId: string): SessionSnapshot | null {
  return sessions.get(caregiverId) ?? null;
}

export function recordSessionVisit(input: {
  caregiver_id: string;
  care_recipient_id: string;
  event_count: number;
  context_updated_at: string;
  visited_at?: string;
}): SessionSnapshot {
  const snapshot: SessionSnapshot = {
    caregiver_id: input.caregiver_id,
    last_visit_at: input.visited_at ?? new Date().toISOString(),
    event_count: input.event_count,
    care_recipient_id: input.care_recipient_id,
    context_updated_at: input.context_updated_at,
  };
  sessions.set(input.caregiver_id, snapshot);
  return snapshot;
}

export function resetRetentionSessionStore(): void {
  sessions.clear();
}
