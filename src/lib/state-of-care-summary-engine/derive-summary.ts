import {
  DETERIORATION_SIGNALS,
  DOMAIN_PATTERNS,
  IMPROVEMENT_SIGNALS,
} from "./contract-constants";
import type { ProcessStateOfCareSummaryInput, StateOfCareSections } from "./types";
import type { CanonicalCareEvent } from "../situation-entry/types";

function activeEvents(events: CanonicalCareEvent[]): CanonicalCareEvent[] {
  return events.filter((e) => e.status !== "invalidated" && e.status !== "superseded");
}

function abstractDomain(event: CanonicalCareEvent): string | null {
  for (const { domain, pattern } of DOMAIN_PATTERNS) {
    if (pattern.test(event.raw_input)) return domain;
  }
  if (event.extracted_type !== "observation" && event.extracted_type !== "unknown") {
    return event.extracted_type.replace(/_/g, " ");
  }
  return null;
}

function abstractObservation(event: CanonicalCareEvent): string {
  const domain = abstractDomain(event);
  if (domain) {
    return `${domain.charAt(0).toUpperCase()}${domain.slice(1)}-related observation recorded`;
  }
  return "Care observation recorded";
}

export function deriveStateOfCareSections(
  input: ProcessStateOfCareSummaryInput,
): StateOfCareSections {
  const events = activeEvents(input.context.events);
  const recentEvents = events.slice(-5);
  const shared = input.multi_caregiver?.shared_reality;

  const what_is_happening_now: string[] = [];

  for (const behavior of input.behavior.observed_behaviors.slice(-3)) {
    what_is_happening_now.push(behavior.label);
  }
  for (const state of shared?.aggregated_state.slice(-3) ?? []) {
    if (!what_is_happening_now.includes(state)) what_is_happening_now.push(state);
  }
  if (what_is_happening_now.length === 0 && recentEvents.length > 0) {
    what_is_happening_now.push(abstractObservation(recentEvents[recentEvents.length - 1]!));
  }
  if (input.crisis_mode?.crisis_mode) {
    what_is_happening_now.unshift("Elevated urgency signals detected in current care context");
  }
  if (what_is_happening_now.length === 0) {
    what_is_happening_now.push("Care context established — awaiting additional observations");
  }

  const what_changed_recently: string[] = [...input.what_changed.slice(0, 5)];
  if (input.behavior.behavioral_change_detected) {
    what_changed_recently.push("Behavioral pattern shift detected in recent observations");
  }
  for (const change of shared?.recent_changes ?? []) {
    if (!what_changed_recently.includes(change)) what_changed_recently.push(change);
  }
  if (what_changed_recently.length === 0) {
    what_changed_recently.push("No significant changes since last update");
  }

  const what_needs_attention: string[] = [];
  if (input.behavior.escalation.escalation_recommended) {
    what_needs_attention.push(...input.behavior.escalation.suggested_actions.slice(0, 2));
  }
  for (const risk of shared?.active_risks ?? []) {
    what_needs_attention.push(risk);
  }
  for (const item of input.continuity_decay.stale_items.slice(0, 2)) {
    what_needs_attention.push(`${item.label}: confidence reduced (${item.stale_reason})`);
  }
  for (const gap of input.continuity_decay.continuity_gaps.filter((g) => g.importance === "high").slice(0, 2)) {
    what_needs_attention.push(gap.label);
  }
  if (input.crisis_mode?.crisis_mode && input.crisis_mode.crisis_output) {
    what_needs_attention.unshift(input.crisis_mode.crisis_output.immediate_concerns[0] ?? "Crisis mode active — review immediate concerns");
  }
  if (what_needs_attention.length === 0 && input.what_needs_clarification.length > 0) {
    what_needs_attention.push(input.what_needs_clarification[0]!);
  }

  const what_is_stable: string[] = [];
  const changedDomains = new Set(
    events.filter((e) => DETERIORATION_SIGNALS.test(e.raw_input) || IMPROVEMENT_SIGNALS.test(e.raw_input))
      .map((e) => abstractDomain(e))
      .filter(Boolean),
  );
  for (const { domain } of DOMAIN_PATTERNS) {
    const hasRecent = recentEvents.some((e) => abstractDomain(e) === domain);
    if (!hasRecent && events.some((e) => abstractDomain(e) === domain)) {
      what_is_stable.push(`${domain.charAt(0).toUpperCase()}${domain.slice(1)} status unchanged in recent period`);
    }
  }
  if (input.continuity_decay.continuity_confidence_pct >= 70 && input.what_changed.length === 0) {
    what_is_stable.push("Overall continuity confidence remains stable");
  }
  if (what_is_stable.length === 0) {
    if (events.length <= 1) {
      what_is_stable.push("Baseline care context established — monitoring for changes");
    } else if (input.what_changed.length === 0) {
      what_is_stable.push("No significant changes since last update");
    }
  }

  const what_remains_uncertain: string[] = [...input.what_is_uncertain.slice(0, 5)];
  for (const item of input.trust_layer?.trust_layer.unknown.slice(0, 3) ?? []) {
    if (!what_remains_uncertain.includes(item.statement)) {
      what_remains_uncertain.push(item.statement);
    }
  }
  for (const q of shared?.unresolved_questions ?? []) {
    if (!what_remains_uncertain.includes(q)) what_remains_uncertain.push(q);
  }
  const provisional = events.filter((e) => e.status === "provisional").length;
  if (provisional > 0) {
    what_remains_uncertain.push(`${provisional} observation(s) remain provisional pending confirmation`);
  }
  if (what_remains_uncertain.length === 0) {
    what_remains_uncertain.push("No unresolved uncertainty flagged at this time");
  }

  const what_should_happen_next: string[] = [];
  what_should_happen_next.push(...input.behavior.recommended_approach.slice(0, 2));
  what_should_happen_next.push(...input.continuity_decay.recheck_prompts.slice(0, 2));
  for (const q of input.what_needs_clarification.slice(0, 2)) {
    if (!what_should_happen_next.includes(q)) what_should_happen_next.push(q);
  }
  if (input.behavior.escalation.escalation_recommended) {
    what_should_happen_next.unshift("Review escalation triggers and confirm safety plan");
  }
  if (what_should_happen_next.length === 0) {
    what_should_happen_next.push("Continue routine monitoring and record any meaningful changes");
  }

  void changedDomains;

  return {
    what_is_happening_now,
    what_changed_recently,
    what_needs_attention,
    what_is_stable,
    what_remains_uncertain,
    what_should_happen_next,
  };
}

export function deriveWhatMattersMost(sections: StateOfCareSections): string {
  if (sections.what_needs_attention.length > 0) {
    return sections.what_needs_attention[0]!;
  }
  if (sections.what_changed_recently[0] !== "No significant changes since last update") {
    return sections.what_changed_recently[0] ?? sections.what_is_happening_now[0]!;
  }
  return sections.what_is_happening_now[0] ?? "Continue routine monitoring";
}
