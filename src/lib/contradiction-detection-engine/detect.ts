import { MOBILITY_STATE_PATTERNS, SAFETY_BLOCKED_CLARIFICATION } from "./contract-constants";
import type { ChangeType, OpenContradiction, TransitionEvent } from "./types";
import type { CanonicalCareEvent } from "../situation-entry/types";

function eventText(event: CanonicalCareEvent): string {
  const snippet = event.attributes.source_situation_text;
  const extra = typeof snippet === "string" ? snippet : "";
  return `${event.raw_input} ${extra}`.trim();
}

function extractMobilityState(text: string): string | null {
  for (const { pattern, state } of MOBILITY_STATE_PATTERNS) {
    if (pattern.test(text)) return state;
  }
  return null;
}

function classifyMobilityTransition(from: string, to: string): ChangeType {
  if (from === "independent walking" && (to === "fall event" || to === "walker required")) {
    return "progression";
  }
  if (from === "fall event" && to === "walker required") return "escalation";
  if (to === "independent walking" && from !== "independent walking") return "recovery";
  if (from === to) return "unclear_transition";
  return "contradiction";
}

function affectsSafety(from: string, to: string): boolean {
  return (
    (from === "independent walking" && to === "walker required") ||
    from === "fall event" ||
    to === "wheelchair required"
  );
}

export function detectMobilityTransitions(
  events: CanonicalCareEvent[],
  asOf: string,
): {
  transitions: TransitionEvent[];
  classifications: { event_id: string; change_type: ChangeType; label: string }[];
  open_contradictions: OpenContradiction[];
  clarification_triggers: string[];
} {
  const transitions: TransitionEvent[] = [];
  const classifications: { event_id: string; change_type: ChangeType; label: string }[] = [];
  const open_contradictions: OpenContradiction[] = [];
  const clarification_triggers: string[] = [];

  const sorted = [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  let priorState: { state: string; event_id: string } | null = null;

  for (const event of sorted) {
    const state = extractMobilityState(eventText(event));
    if (!state) continue;

    if (!priorState) {
      priorState = { state, event_id: event.id };
      classifications.push({
        event_id: event.id,
        change_type: "unclear_transition",
        label: state,
      });
      continue;
    }

    if (priorState.state === state) continue;

    const changeType = classifyMobilityTransition(priorState.state, state);
    const confidence =
      changeType === "progression" ? 0.75 : changeType === "contradiction" ? 0.55 : 0.65;

    transitions.push({
      transition_id: `trans_${priorState.event_id}_${event.id}`,
      from_state: priorState.state,
      to_state: state,
      evidence: [priorState.event_id, event.id],
      type: changeType,
      confidence,
      linked_events: [priorState.event_id, event.id],
      contradiction_flag: changeType === "contradiction",
      recorded_at: asOf,
    });

    classifications.push({
      event_id: event.id,
      change_type: changeType,
      label: `${priorState.state} → ${state}`,
    });

    open_contradictions.push({
      contradiction_id: `con_${priorState.event_id}_${event.id}`,
      field: "mobility",
      event_ids: [priorState.event_id, event.id],
      both_preserved: true,
      shared_message: `Mobility evolution: ${priorState.state} → ${state} (both observations preserved)`,
      affects_safety: affectsSafety(priorState.state, state),
    });

    if (affectsSafety(priorState.state, state) && changeType !== "recovery") {
      clarification_triggers.push(SAFETY_BLOCKED_CLARIFICATION[0]!);
      if (state === "walker required") {
        clarification_triggers.push(SAFETY_BLOCKED_CLARIFICATION[2]!);
      }
    }

    priorState = { state, event_id: event.id };
  }

  return {
    transitions,
    classifications,
    open_contradictions,
    clarification_triggers: [...new Set(clarification_triggers)],
  };
}

export function mergeTimelineContradictions(
  timelineConflicts: import("../care-timeline-engine/types").TimelineConflict[],
): OpenContradiction[] {
  return timelineConflicts.map((c) => ({
    contradiction_id: c.conflict_id,
    field: c.field,
    event_ids: c.related_events,
    both_preserved: true as const,
    shared_message: c.shared_message,
    affects_safety: c.field.includes("medication") || c.field.includes("dosage"),
  }));
}
