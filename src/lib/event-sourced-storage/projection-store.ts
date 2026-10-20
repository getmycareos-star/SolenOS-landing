/** Projection store — CareContext as computed view from Event Store. */

import { getEventStream } from "./event-store";
import type { CareContextProjection } from "./types";

const projections = new Map<string, CareContextProjection>();

/**
 * Rebuild CareContext projection from Event Store alone.
 * NEVER manually edit — always recompute.
 */
export function rebuildProjection(input: {
  care_recipient_id: string;
  as_of?: string;
}): CareContextProjection {
  const events = getEventStream(input.care_recipient_id);
  const asOf = input.as_of ?? new Date().toISOString();
  const active = events.filter((e) => e.timestamp <= asOf);

  const active_issues = active
    .filter((e) => e.confidence < 0.55 || /fall|refus|confus|urgent/i.test(e.raw_observation))
    .map((e) => e.raw_observation.slice(0, 100))
    .slice(-5);

  const avgConfidence =
    active.length === 0
      ? 0.15
      : active.reduce((s, e) => s + e.confidence, 0) / active.length;

  const projection: CareContextProjection = {
    projection_id: `proj_${input.care_recipient_id}_${active.length}`,
    care_recipient_id: input.care_recipient_id,
    rebuilt_from_event_count: active.length,
    rebuilt_at: asOf,
    current_state_summary: active.slice(-5).map((e) => e.raw_observation.slice(0, 120)),
    active_issues,
    unresolved_contradictions: 0,
    confidence_summary: Number(avgConfidence.toFixed(3)),
    event_ids: active.map((e) => e.event_id),
  };

  projections.set(input.care_recipient_id, projection);
  return projection;
}

export function getProjection(careRecipientId: string): CareContextProjection | null {
  return projections.get(careRecipientId) ?? null;
}

export function resetProjectionStore(): void {
  projections.clear();
}
