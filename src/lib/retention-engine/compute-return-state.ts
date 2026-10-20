import { DETERIORATION_SIGNALS, IMPROVEMENT_SIGNALS } from "../care-context-diff-engine/contract-constants";
import { MAX_RETURN_ACTION_ITEMS, RETURN_DELTA_THRESHOLD_MS } from "./contract-constants";
import { getLastSessionSnapshot } from "./session-store";
import type { ProcessRetentionEngineInput, ReturnStateOfCare, ReturnStateSections } from "./types";

function eventsSinceLastVisit(
  context: ProcessRetentionEngineInput["context"],
  priorEventCount: number,
): import("../situation-entry/types").CanonicalCareEvent[] {
  if (priorEventCount >= context.events.length) return [];
  return context.events.slice(priorEventCount);
}

export function computeReturnStateOfCare(input: ProcessRetentionEngineInput): ReturnStateOfCare {
  const asOf = input.as_of ?? new Date().toISOString();
  const prior = getLastSessionSnapshot(input.caregiver_id);
  const inactiveMs = prior
    ? new Date(asOf).getTime() - new Date(prior.last_visit_at).getTime()
    : 0;
  const isReturnSession = inactiveMs >= RETURN_DELTA_THRESHOLD_MS && prior !== null;

  const newEvents = prior ? eventsSinceLastVisit(input.context, prior.event_count) : [];
  const diff = input.care_context_diff?.diff.sections;

  const what_changed_since_last_visit: string[] = [];
  if (newEvents.length > 0) {
    for (const event of newEvents.slice(-5)) {
      what_changed_since_last_visit.push(
        `${event.extracted_type.replace(/_/g, " ")}: ${event.raw_input.slice(0, 80)}`,
      );
    }
  }
  for (const line of diff?.factual_delta ?? []) {
    if (!what_changed_since_last_visit.includes(line)) {
      what_changed_since_last_visit.push(line);
    }
  }
  for (const line of diff?.newly_important ?? []) {
    what_changed_since_last_visit.push(line);
  }
  if (what_changed_since_last_visit.length === 0 && isReturnSession) {
    what_changed_since_last_visit.push("No new CareEvents since last visit — reviewing current state");
  }

  const what_got_worse: string[] = [];
  for (const line of diff?.directional_change ?? []) {
    if (DETERIORATION_SIGNALS.test(line)) what_got_worse.push(line);
  }
  for (const event of newEvents) {
    if (DETERIORATION_SIGNALS.test(event.raw_input)) {
      what_got_worse.push(event.raw_input.slice(0, 100));
    }
  }
  for (const c of input.contradiction_detection?.open_contradictions ?? []) {
    if (c.affects_safety) what_got_worse.push(c.shared_message);
  }
  for (const item of input.continuity_decay?.stale_items.slice(0, 2) ?? []) {
    what_got_worse.push(`Confidence declining: ${item.label}`);
  }

  const what_got_better: string[] = [];
  for (const line of diff?.directional_change ?? []) {
    if (IMPROVEMENT_SIGNALS.test(line)) what_got_better.push(line);
  }
  for (const event of newEvents) {
    if (IMPROVEMENT_SIGNALS.test(event.raw_input)) {
      what_got_better.push(event.raw_input.slice(0, 100));
    }
  }
  for (const line of diff?.stabilized ?? []) {
    what_got_better.push(line);
  }

  const what_needs_action_now: string[] = [];
  const tasks = input.tasks?.open_tasks ?? [];
  for (const task of tasks.slice(0, MAX_RETURN_ACTION_ITEMS)) {
    what_needs_action_now.push(task.description);
  }
  for (const trigger of input.contradiction_detection?.clarification_triggers.slice(0, 2) ?? []) {
    if (what_needs_action_now.length < MAX_RETURN_ACTION_ITEMS) {
      what_needs_action_now.push(trigger);
    }
  }
  if (what_needs_action_now.length === 0 && input.state_of_care?.summary.what_matters_most) {
    what_needs_action_now.push(input.state_of_care.summary.what_matters_most);
  }

  const what_is_stable: string[] = [
    ...(diff?.stabilized ?? []),
    ...(input.state_of_care?.summary.sections.what_is_stable ?? []),
  ].slice(0, 5);
  if (what_is_stable.length === 0) {
    what_is_stable.push("No urgent changes flagged — monitoring continuity");
  }

  const sections: ReturnStateSections = {
    what_changed_since_last_visit: [...new Set(what_changed_since_last_visit)].slice(0, 6),
    what_got_worse: [...new Set(what_got_worse)].slice(0, 5),
    what_got_better: [...new Set(what_got_better)].slice(0, 5),
    what_needs_action_now: what_needs_action_now.slice(0, MAX_RETURN_ACTION_ITEMS),
    what_is_stable: [...new Set(what_is_stable)].slice(0, 5),
  };

  const headline =
    sections.what_changed_since_last_visit[0] ??
    "Current care state recomputed from CareContext";

  return {
    computed_at: asOf,
    last_visit_at: prior?.last_visit_at ?? null,
    inactive_ms: inactiveMs,
    is_return_session: isReturnSession,
    sections,
    headline,
  };
}
