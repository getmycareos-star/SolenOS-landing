import { queryPriorityEvents } from "../care-event-priority";
import type { CareContextRoot } from "../situation-entry/types";
import { computeStateDiff, diffToSummaryLines } from "./diff-engine";
import { getLastContextSnapshot, getOpenUncertainties } from "./uncertainty-store";
import type { IdleRefreshResult } from "./types";

export function runIdleLoop(input: {
  caregiver_id: string;
  context: CareContextRoot;
}): IdleRefreshResult {
  const snapshot = getLastContextSnapshot(input.caregiver_id);
  const priorityQuery = queryPriorityEvents(input.context.events);
  const openUncertainties = getOpenUncertainties(input.caregiver_id);

  const sinceLastLoop: string[] = [];
  if (snapshot) {
    const eventDelta = input.context.events.length - snapshot.event_count;
    if (eventDelta > 0) {
      sinceLastLoop.push(`${eventDelta} new event${eventDelta === 1 ? "" : "s"} since last loop.`);
    }
    const uncertaintyDelta = openUncertainties.length - snapshot.uncertainty_count;
    if (uncertaintyDelta > 0) {
      sinceLastLoop.push(`${uncertaintyDelta} new open uncertainty item${uncertaintyDelta === 1 ? "" : "s"}.`);
    } else if (uncertaintyDelta < 0) {
      sinceLastLoop.push(`${Math.abs(uncertaintyDelta)} uncertainty item${Math.abs(uncertaintyDelta) === 1 ? "" : "s"} resolved.`);
    }
  }

  if (sinceLastLoop.length === 0) {
    sinceLastLoop.push("No structural changes since last loop — priorities recomputed.");
  }

  return {
    since_last_loop: sinceLastLoop,
    at_risk_event_ids: priorityQuery.attention_events.map((e) => e.id).slice(0, 5),
    missing_information: openUncertainties.slice(0, 5),
    recomputed_only: true,
  };
}

export function computeIdleDiff(
  priorContext: CareContextRoot | null,
  currentContext: CareContextRoot,
): ReturnType<typeof computeStateDiff> {
  return computeStateDiff(priorContext, currentContext, [], null);
}

export function idleDiffToChanges(
  priorContext: CareContextRoot | null,
  currentContext: CareContextRoot,
): string[] {
  const diff = computeIdleDiff(
    priorContext,
    currentContext,
  );
  return diffToSummaryLines(diff, currentContext.events);
}

