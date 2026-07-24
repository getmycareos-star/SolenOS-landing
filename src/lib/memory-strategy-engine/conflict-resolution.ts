import type { CanonicalCareEvent } from "../situation-entry/types";
import type { MemoryConflict, MemoryRecord } from "./types";

const MOBILITY_STATES = [
  { pattern: /\b(wheelchair|wheel chair)\b/i, state: "wheelchair" },
  { pattern: /\b(walker|walking stick|cane)\b/i, state: "uses walker" },
  { pattern: /\b(walks?\s+independently|independent(?:ly)?|ambulat\w*)\b/i, state: "independent walking" },
] as const;

function eventText(event: CanonicalCareEvent): string {
  const snippet = event.attributes.source_situation_text;
  const extra = typeof snippet === "string" ? snippet : "";
  return `${event.raw_input} ${extra}`;
}

function extractMobilityState(text: string): string | null {
  for (const { pattern, state } of MOBILITY_STATES) {
    if (pattern.test(text)) return state;
  }
  return null;
}

export function detectMemoryConflicts(
  events: CanonicalCareEvent[],
  records: MemoryRecord[],
): MemoryConflict[] {
  const conflicts: MemoryConflict[] = [];
  const priorMobility = records.filter(
    (r) =>
      r.status === "active" &&
      r.tier !== "session" &&
      extractMobilityState(r.label) !== null,
  );

  for (const event of events) {
    const newState = extractMobilityState(eventText(event));
    if (!newState) continue;

    for (const prior of priorMobility) {
      const priorState = extractMobilityState(prior.label);
      if (!priorState || priorState === newState) continue;

      conflicts.push({
        conflict_id: `conf_${prior.id}_${event.id}`,
        existing_memory_id: prior.id,
        new_event_id: event.id,
        description: `Mobility transition detected — preserve history: ${priorState} → ${newState}`,
        resolution: "transition_recorded",
      });
      break;
    }
  }

  return conflicts;
}

export function buildTransitionEvents(conflicts: MemoryConflict[]): import("./types").MemoryTransition[] {
  return conflicts.map((c) => ({
    transition_id: `trans_${c.conflict_id}`,
    memory_id: c.existing_memory_id,
    from_state: "prior mobility state",
    to_state: "updated observation",
    reason: c.description,
    source_event_id: c.new_event_id,
    recorded_at: new Date().toISOString(),
  }));
}
