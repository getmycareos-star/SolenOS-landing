import {
  CATEGORY_PATTERNS,
  DETERIORATION_SIGNALS,
  IMPROVEMENT_SIGNALS,
} from "./contract-constants";
import type { CareContextDiffSections, ProcessCareContextDiffInput } from "./types";
import type { CanonicalCareEvent } from "../situation-entry/types";
import type { ChangeCategory } from "./types";
import { domainForEvent } from "../care-state-change-detector";
import { caregiverFieldLabel, caregiverSafeGeneratedText, caregiverStatusLabel } from "../caregiver-language";

function classifyChange(text: string): ChangeCategory {
  for (const { category, pattern } of CATEGORY_PATTERNS) {
    if (pattern.test(text)) return category;
  }
  return "other";
}

function formatCategoryLabel(category: ChangeCategory): string {
  return category
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function daysBetween(from: string, to: string): number {
  const ms = new Date(to).getTime() - new Date(from).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

export function computeCareContextDiffSections(
  input: ProcessCareContextDiffInput,
  priorComprehendedAt: string | null,
): CareContextDiffSections {
  const {
    state_diff,
    context,
    events_created,
    what_changed,
    behavior,
    continuity_decay,
    care_state_change_report,
  } = input;
  const activeEvents = context.events.filter(
    (e) => e.status !== "invalidated" && e.status !== "superseded",
  );

  const factual_delta: string[] = [];

  // Primary: semantic state changes from care-state-change-detector
  const stateChanges = care_state_change_report?.primary_changes ?? [];
  const semanticChanges = stateChanges
    .filter(
      (c) =>
        c.classification !== "STABLE" &&
        c.classification !== "UNCERTAIN" &&
        c.confidence !== "low",
    )
    .slice(0, 5);
  for (const change of semanticChanges) {
    const domain = caregiverFieldLabel(change.domain) || "Care details";
    const classification = caregiverStatusLabel(change.classification) || "Possible change";
    const uncertaintyNote = change.confidence === "medium" ? ". This may need checking." : "";
    factual_delta.push(`${domain}: ${classification}${uncertaintyNote}`);
  }

  // Fallback: structural event changes
  if (factual_delta.length === 0) {
    for (const event of events_created) {
      const domain = caregiverFieldLabel(domainForEvent(event) || "");
      const text = domain
        ? `A new ${domain.toLowerCase()} detail was saved.`
        : "A new care detail was saved.";
      factual_delta.push(text);
    }
  }

  for (const id of state_diff.updated_events.slice(0, 2)) {
    const event = context.events.find((e) => e.id === id);
    if (event) {
      const domain = caregiverFieldLabel(domainForEvent(event) || "");
      const text = domain
        ? `Earlier ${domain.toLowerCase()} details were updated.`
        : "An earlier care detail was updated.";
      factual_delta.push(text);
    }
  }
  for (const id of state_diff.invalidated_events.slice(0, 2)) {
    factual_delta.push("An earlier care detail was marked as no longer accurate.");
    void id;
  }
  for (const id of state_diff.resolved_uncertainty.slice(0, 2)) {
    factual_delta.push("A detail that was unclear has now been clarified.");
    void id;
  }
  for (const line of what_changed.slice(0, 3)) {
    const safeLine = caregiverSafeGeneratedText(line);
    if (safeLine && !factual_delta.some((d) => d === safeLine)) factual_delta.push(safeLine);
  }
  if (factual_delta.length === 0) {
    factual_delta.push("No new care changes were found in the information checked.");
  }

  const directional_change: string[] = [];

  // Primary: semantic trajectory from state change report
  if (stateChanges.length > 0) {
    const worsening = stateChanges.filter(
      (c) => c.trajectory === "worsening" && c.classification !== "NEW",
    );
    const improving = stateChanges.filter(
      (c) => c.trajectory === "improving" && c.classification !== "RESOLVED",
    );
    const newDomains = stateChanges.filter((c) => c.classification === "NEW");

    if (worsening.length >= 2) {
      const domains = worsening.map((c) => caregiverFieldLabel(c.domain) || "care details").join(" and ");
      directional_change.push(`Changes may be getting harder in more than one area: ${domains}.`);
    } else if (worsening.length === 1) {
      const domain = caregiverFieldLabel(worsening[0]!.domain) || "Care details";
      directional_change.push(`A change in ${domain.toLowerCase()} may need attention.`);
    }
    if (improving.length > 0 && worsening.length === 0) {
      const domains = improving.map((c) => caregiverFieldLabel(c.domain) || "care details").join(" and ");
      directional_change.push(`Some changes may be improving: ${domains}.`);
    }
    if (newDomains.length >= 2) {
      const domains = newDomains.map((c) => caregiverFieldLabel(c.domain) || "care details").join(" and ");
      directional_change.push(`New care details were shared about: ${domains}.`);
    }
  }

  // Fallback: signal counting
  if (directional_change.length === 0) {
    const recentText = activeEvents.slice(-8).map((e) => e.raw_input).join(" ");
    const improvementCount = activeEvents.filter((e) => IMPROVEMENT_SIGNALS.test(e.raw_input)).length;
    const deteriorationCount = activeEvents.filter((e) => DETERIORATION_SIGNALS.test(e.raw_input)).length;

    if (behavior.behavioral_change_detected) {
      directional_change.push("A change in behavior was noticed recently.");
    }
    if (deteriorationCount > improvementCount) {
      directional_change.push("The information shared may point to increasing care needs.");
    } else if (improvementCount > deteriorationCount && deteriorationCount === 0) {
      directional_change.push("The information shared may point to improvement.");
    }
    for (const pattern of input.multi_caregiver?.conflict_log.slice(-2) ?? []) {
      const safeMessage = caregiverSafeGeneratedText(pattern.shared_abstract_message);
      if (safeMessage) directional_change.push(safeMessage);
    }
    if (DETERIORATION_SIGNALS.test(recentText) && directional_change.length === 0) {
      directional_change.push("Recent care updates may point to a change that needs attention.");
    }
  }

  const newly_important: string[] = [];
  if (input.attention_event_ids.length > 0) {
    newly_important.push(`${input.attention_event_ids.length} care detail${input.attention_event_ids.length === 1 ? "" : "s"} may need attention.`);
  }
  if (behavior.escalation.risk_elevation === "high") {
    newly_important.push("A possible safety concern needs a closer look.");
  }
  for (const risk of input.multi_caregiver?.shared_reality.active_risks.slice(0, 2) ?? []) {
    const safeRisk = caregiverSafeGeneratedText(risk);
    if (safeRisk) newly_important.push(safeRisk);
  }
  for (const gap of continuity_decay.continuity_gaps.filter((g) => g.importance === "high").slice(0, 2)) {
    const gapLabel = caregiverSafeGeneratedText(gap.label);
    newly_important.push(gapLabel ? `Some care information may be missing: ${gapLabel}.` : "Some care information may be missing.");
  }

  const lost_confidence: string[] = [];
  for (const stale of continuity_decay.stale_items.slice(0, 3)) {
    lost_confidence.push(
      `Some information about ${caregiverSafeGeneratedText(stale.label) || "this care detail"} may be out of date: ${caregiverSafeGeneratedText(stale.stale_reason) || "we have not received a recent update"}.`,
    );
  }
  for (const [domain, score] of Object.entries(
    input.multi_caregiver?.shared_reality.confidence_map ?? {},
  )) {
    if (score < 0.5) {
      lost_confidence.push(`Reports about ${caregiverFieldLabel(domain)?.toLowerCase() || "this care detail"} do not match.`);
    }
  }
  if (continuity_decay.family_rhythm.meaningful_gap) {
    const days = continuity_decay.family_rhythm.days_since_last_update;
    lost_confidence.push(`No care updates have been added in ${days} days, so some details may be out of date.`);
  }

  const stabilized: string[] = [];
  if (state_diff.resolved_uncertainty.length > 0) {
    stabilized.push("Some details that were unclear have now been explained.");
  }
  if (what_changed.length === 0 && events_created.length === 0) {
    stabilized.push("No changes were found in the care details checked since the last review.");
  }
  if (input.state_of_care?.sections.what_is_stable.length) {
    for (const line of input.state_of_care.sections.what_is_stable.slice(0, 2)) {
      const safeLine = caregiverSafeGeneratedText(line);
      if (safeLine && !stabilized.includes(safeLine)) stabilized.push(safeLine);
    }
  }

  const system_interpretation: string[] = [];
  if (input.state_of_care) {
    system_interpretation.push(
      `Current focus: ${caregiverSafeGeneratedText(input.state_of_care.what_matters_most) || "the care details shared so far"}`,
    );
  }

  // Use semantic trajectory summary when available
  if (care_state_change_report?.trajectory_summary) {
    system_interpretation.push(caregiverSafeGeneratedText(care_state_change_report.trajectory_summary) || "Recent care updates may show a change over time.");
  } else if (directional_change.length > 0 && newly_important.length > 0) {
    system_interpretation.push(
      "Several recent changes may mean care needs are increasing.",
    );
  } else if (what_changed.length === 0 && events_created.length === 0) {
    system_interpretation.push("No important changes were found in the information checked since the last review.");
  } else if (directional_change.length > 0 && /improvement|stabilization/i.test(directional_change.join(" "))) {
    system_interpretation.push("Recent care updates may point to some improvement.");
  } else {
    system_interpretation.push("Care information has changed. Check what needs attention and what to do next.");
  }

  if (priorComprehendedAt) {
    const days = daysBetween(priorComprehendedAt, input.as_of ?? new Date().toISOString());
    if (days >= 3 && directional_change.length === 0) {
      system_interpretation.push(`We have not found a clear change in the past ${days} days.`);
    }
  }

  return {
    factual_delta,
    directional_change,
    newly_important,
    lost_confidence,
    stabilized,
    system_interpretation,
  };
}

export function derivePrimaryChange(sections: CareContextDiffSections): string {
  const safetyFirst = [
    ...sections.newly_important,
    ...sections.directional_change.filter((d) => /deterioration|escalation|risk|inconsistent/i.test(d)),
    ...sections.factual_delta,
    ...sections.directional_change,
    ...sections.system_interpretation,
  ];
  return safetyFirst[0] ?? "No important changes were found in the information checked.";
}

export function deriveTimeFrame(
  priorComprehendedAt: string | null,
  asOf: string,
): { time_frame: string; relative_to: string } {
  if (!priorComprehendedAt) {
    return {
      time_frame: "since the first care update",
      relative_to: asOf,
    };
  }
  const days = daysBetween(priorComprehendedAt, asOf);
  if (days === 0) {
    return { time_frame: "since last update", relative_to: priorComprehendedAt };
  }
  if (days <= 3) {
    return { time_frame: `over past ${days} day(s)`, relative_to: priorComprehendedAt };
  }
  return { time_frame: "since the last clear change", relative_to: priorComprehendedAt };
}

export function hasMeaningfulChange(sections: CareContextDiffSections, eventsCreated: number): boolean {
  if (eventsCreated > 0) return true;
  const nonEmpty = [
    ...sections.directional_change,
    ...sections.newly_important,
    ...sections.lost_confidence,
  ];
  return nonEmpty.length > 0;
}
