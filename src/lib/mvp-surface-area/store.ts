const lastVisitByCaregiver = new Map<string, string>();
const lastEventCountByCaregiver = new Map<string, number>();
const lastUnresolvedByCaregiver = new Map<string, string[]>();

export function recordMvpVisit(caregiverId: string, eventCount: number, unresolved: string[]): void {
  lastVisitByCaregiver.set(caregiverId, new Date().toISOString());
  lastEventCountByCaregiver.set(caregiverId, eventCount);
  lastUnresolvedByCaregiver.set(caregiverId, [...unresolved]);
}

export function getLastMvpVisit(caregiverId: string): {
  visited_at: string | null;
  prior_event_count: number;
  prior_unresolved: string[];
} {
  return {
    visited_at: lastVisitByCaregiver.get(caregiverId) ?? null,
    prior_event_count: lastEventCountByCaregiver.get(caregiverId) ?? 0,
    prior_unresolved: lastUnresolvedByCaregiver.get(caregiverId) ?? [],
  };
}

export function resetMvpSurfaceStore(): void {
  lastVisitByCaregiver.clear();
  lastEventCountByCaregiver.clear();
  lastUnresolvedByCaregiver.clear();
}
