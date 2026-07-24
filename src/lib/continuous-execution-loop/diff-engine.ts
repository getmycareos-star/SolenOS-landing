import type { DareIngestResult } from "../data-acquisition-resilience/types";
import type { CanonicalCareEvent, CareContextRoot } from "../situation-entry/types";
import { MAX_DIFF_SUMMARY_LINES } from "./contract-constants";
import type { StateDiff } from "./types";

function eventSnapshotKey(event: CanonicalCareEvent): string {
  return [
    event.id,
    event.status,
    event.raw_input,
    event.extracted_type,
    event.uncertainty.join("|"),
    event.integrity.superseded_by_id ?? "",
  ].join("::");
}

export function computeStateDiff(
  priorContext: CareContextRoot | null,
  currentContext: CareContextRoot,
  eventsCreated: CanonicalCareEvent[],
  dare: DareIngestResult | null,
): StateDiff {
  const priorEvents = priorContext?.events ?? [];
  const currentEvents = currentContext.events;
  const priorById = new Map(priorEvents.map((e) => [e.id, e]));
  const priorSnapshot = new Map(priorEvents.map((e) => [e.id, eventSnapshotKey(e)]));
  const priorUncertainties = new Set(priorEvents.flatMap((e) => e.uncertainty));

  const diff: StateDiff = {
    newly_added_events: [],
    updated_events: [],
    resolved_uncertainty: [],
    new_uncertainty: [],
    conflicts_detected: [],
    follow_ups_created: [],
    follow_ups_closed: [],
    superseded_events: [],
    invalidated_events: [],
  };

  for (const event of eventsCreated) {
    if (!priorById.has(event.id)) {
      diff.newly_added_events.push(event.id);
    }
  }

  for (const event of currentEvents) {
    const prior = priorSnapshot.get(event.id);
    if (prior && prior !== eventSnapshotKey(event)) {
      diff.updated_events.push(event.id);
    }
    if (event.status === "superseded" && !priorEvents.some((p) => p.id === event.id && p.status === "superseded")) {
      diff.superseded_events.push(event.id);
    }
    if (event.status === "invalidated" && !priorEvents.some((p) => p.id === event.id && p.status === "invalidated")) {
      diff.invalidated_events.push(event.id);
    }
  }

  const currentUncertainties = new Set(currentEvents.flatMap((e) => e.uncertainty));
  for (const u of currentUncertainties) {
    if (!priorUncertainties.has(u)) diff.new_uncertainty.push(u);
  }
  for (const u of priorUncertainties) {
    if (!currentUncertainties.has(u)) diff.resolved_uncertainty.push(u);
  }

  for (const event of eventsCreated.filter((e) => e.extracted_type === "follow_up")) {
    diff.follow_ups_created.push(event.id);
  }

  if (dare) {
    for (const c of dare.conflicts) {
      diff.conflicts_detected.push(c.event_signal);
    }
    for (const q of dare.disambiguation_questions) {
      if (priorUncertainties.has(q.question)) {
        diff.resolved_uncertainty.push(q.question);
      }
    }
  }

  return diff;
}

export function diffToSummaryLines(diff: StateDiff, events: CanonicalCareEvent[]): string[] {
  const byId = new Map(events.map((e) => [e.id, e]));
  const lines: string[] = [];

  if (diff.newly_added_events.length > 0 && events.length === diff.newly_added_events.length) {
    lines.push("CareContextRoot created with first situation event.");
  }

  for (const id of diff.newly_added_events.slice(0, 4)) {
    const event = byId.get(id);
    if (event) {
      lines.push(
        `New event added (${event.extracted_type.replace(/_/g, " ")}): ${event.raw_input.slice(0, 80)}${event.raw_input.length > 80 ? "…" : ""}`,
      );
    }
  }

  for (const id of diff.updated_events.slice(0, 2)) {
    const event = byId.get(id);
    if (event) {
      lines.push(`Event updated: ${event.raw_input.slice(0, 60)}…`);
    }
  }

  for (const id of diff.superseded_events.slice(0, 2)) {
    lines.push(`Prior interpretation superseded (event ${id}) — original preserved.`);
  }

  for (const id of diff.invalidated_events.slice(0, 2)) {
    lines.push(`Event invalidated (event ${id}) — audit trail preserved.`);
  }

  for (const u of [...new Set(diff.new_uncertainty)].slice(0, 3)) {
    lines.push(`New uncertainty introduced: ${u}`);
  }

  for (const u of diff.resolved_uncertainty.slice(0, 2)) {
    lines.push(`Uncertainty resolved: ${u}`);
  }

  for (const c of diff.conflicts_detected.slice(0, 2)) {
    lines.push(`Conflicting claims detected for ${c.replace(/_/g, " ")}`);
  }

  for (const id of diff.follow_ups_created.slice(0, 2)) {
    const event = byId.get(id);
    if (event) {
      lines.push(`New follow-up created: ${event.raw_input.slice(0, 60)}…`);
    }
  }

  if (lines.length === 0 && diff.newly_added_events.length > 0) {
    lines.push("Previous context updated with additional structured detail.");
  }

  return lines.slice(0, MAX_DIFF_SUMMARY_LINES);
}

export function diffHasOutputTrigger(diff: StateDiff): boolean {
  return (
    diff.newly_added_events.length > 0 ||
    diff.updated_events.length > 0 ||
    diff.new_uncertainty.length > 0 ||
    diff.resolved_uncertainty.length > 0 ||
    diff.conflicts_detected.length > 0 ||
    diff.follow_ups_created.length > 0 ||
    diff.superseded_events.length > 0 ||
    diff.invalidated_events.length > 0
  );
}
