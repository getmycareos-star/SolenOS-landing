import type { CanonicalCareEvent } from "../situation-entry/types";
import type { MultiCaregiverConflict } from "./types";

export type SharedRealityState = {
  care_recipient_id: string;
  aggregated_state: string[];
  active_risks: string[];
  recent_changes: string[];
  unresolved_questions: string[];
  confidence_map: Record<string, number>;
};

function abstractObservation(event: CanonicalCareEvent): string {
  const text = event.raw_input.slice(0, 120);
  return text.replace(/\b(I|we|my|our)\b/gi, "").trim();
}

export function fuseSharedReality(input: {
  care_recipient_id: string;
  events: CanonicalCareEvent[];
  conflicts: MultiCaregiverConflict[];
  what_changed: string[];
}): SharedRealityState {
  const recent = input.events
    .filter((e) => e.status !== "invalidated" && e.status !== "superseded")
    .slice(-5);

  const aggregated_state = recent.map((e) => abstractObservation(e)).filter(Boolean);

  for (const conflict of input.conflicts) {
    if (conflict.shared_abstract_message) {
      aggregated_state.push(conflict.shared_abstract_message);
    }
  }

  const active_risks = input.conflicts.map((c) => `${c.contradiction_type}: inconsistent reports`);

  const unresolved_questions = input.conflicts
    .filter((c) => c.resolution_status === "preserved_both" || c.resolution_status === "open")
    .map((c) => c.shared_abstract_message ?? `Status unclear: ${c.contradiction_type}`);

  const confidence_map: Record<string, number> = {};
  for (const conflict of input.conflicts) {
    confidence_map[conflict.contradiction_type] = 0.45;
  }
  if (Object.keys(confidence_map).length === 0) {
    confidence_map.general = 0.75;
  }

  return {
    care_recipient_id: input.care_recipient_id,
    aggregated_state: [...new Set(aggregated_state)].slice(0, 8),
    active_risks: [...new Set(active_risks)],
    recent_changes: input.what_changed.slice(0, 5),
    unresolved_questions: [...new Set(unresolved_questions)].slice(0, 5),
    confidence_map,
  };
}
