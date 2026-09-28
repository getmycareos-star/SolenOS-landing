import type { CanonicalCareEvent, CareContextRoot } from "./types";
import type { BaselineFact, BaselineDeviation } from "../baseline-intelligence-engine/types";
import { detectCareStateChanges } from "../care-state-change-detector";

export function computeWhatChanged(
  priorContext: CareContextRoot | null,
  newEvents: CanonicalCareEvent[],
  baselineFacts: BaselineFact[] = [],
  baselineDeviations: BaselineDeviation[] = [],
): string[] {
  const currentContext: CareContextRoot = priorContext
    ? { ...priorContext, events: [...priorContext.events, ...newEvents] }
    : {
        id: "CareContextRoot",
        care_recipient_id: "",
        caregiver_id: "",
        events: newEvents,
        root_event_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        multi_caregiver: {
          care_recipient_id: "",
          care_recipient_label: null,
          caregivers: [],
          attribution_map: [],
          source_confidence_profiles: [],
          conflict_log: [],
        },
      };

  const report = detectCareStateChanges({
    priorContext,
    currentContext,
    eventsCreated: newEvents,
    baselineFacts,
    baselineDeviations,
  });

  const changes: string[] = [];
  // What arrived always comes first: before a change can be read as a change,
  // the caregiver has to see that something new was recorded.
  if (newEvents.length > 0) {
    const kinds = [...new Set(newEvents.map((e) => e.extracted_type.replace(/_/g, " ")))];
    changes.push(
      kinds.length === 1
        ? `New event added: ${kinds[0]}.`
        : `New events added: ${kinds.slice(0, 3).join(", ")}.`,
    );
  }
  for (const change of report.all_changes) {
    const classification = change.classification;
    const domain = change.domain.replace(/_/g, " ");
    changes.push(`${classification} in ${domain}: ${change.current_state.slice(0, 100)}`);
  }
  for (const signal of report.compound_signals) {
    changes.push(signal.description);
  }
  if (report.trajectory_summary && report.trajectory_summary !== "No directional signals detected yet") {
    changes.push(report.trajectory_summary);
  }
  return changes.slice(0, 6);
}
