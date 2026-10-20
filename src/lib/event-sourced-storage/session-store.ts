/** Session store — interaction context for return / first-60s detection. */

import type { SessionStoreRecord } from "./types";

const sessions = new Map<string, SessionStoreRecord>();

export function getSessionRecord(caregiverId: string): SessionStoreRecord | null {
  return sessions.get(caregiverId) ?? null;
}

export function upsertSessionRecord(
  update: Partial<SessionStoreRecord> & { caregiver_id: string },
): SessionStoreRecord {
  const prior = sessions.get(update.caregiver_id);
  const next: SessionStoreRecord = {
    caregiver_id: update.caregiver_id,
    last_visit_at: update.last_visit_at ?? prior?.last_visit_at ?? null,
    event_count_at_visit: update.event_count_at_visit ?? prior?.event_count_at_visit ?? 0,
    engagement_state: update.engagement_state ?? prior?.engagement_state ?? "new",
    last_projection_id: update.last_projection_id ?? prior?.last_projection_id ?? null,
    visit_count: update.visit_count ?? prior?.visit_count ?? 0,
  };
  sessions.set(update.caregiver_id, next);
  return next;
}

export function resetSessionStore(): void {
  sessions.clear();
}
