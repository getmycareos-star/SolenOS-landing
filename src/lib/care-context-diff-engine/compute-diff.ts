import {
  CATEGORY_PATTERNS,
} from "./contract-constants";
import type { CareContextDiffSections, ProcessCareContextDiffInput } from "./types";
import type { CanonicalCareEvent } from "../situation-entry/types";
import type { ChangeCategory } from "./types";
import { domainForEvent } from "../care-state-change-detector";

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
    const domain = change.domain.replace(/_/g, " ");
    const classification = change.classification.toLowerCase();
    const confidence =
      change.confidence === "high"
        ? ""
        : change.confidence === "medium"
          ? " (moderate confidence)"
          : " (needs confirmation)";
    factual_delta.push(`${domain} — ${classification}${confidence}`);
  }

  // Fallback: structural event changes
  if (factual_delta.length === 0) {
    for (const event of events_created) {
      const domain = domainForEvent(event);
      const typeLabel = event.extracted_type.replace(/_/g, " ");
      const text = domain
        ? `New ${domain} observation recorded`
        : `New ${typeLabel} recorded`;
      factual_delta.push(text);
    }
  }

  for (const id of state_diff.updated_events.slice(0, 2)) {
    const event = context.events.find((e) => e.id === id);
    if (event) {
      const domain = domainForEvent(event);
      const text = domain
        ? `Existing ${domain} observation updated`
        : "Existing observation updated";
      factual_delta.push(text);
    }
  }
  for (const id of state_diff.invalidated_events.slice(0, 2)) {
    factual_delta.push("Prior observation marked as no longer valid");
    void id;
  }
  for (const id of state_diff.resolved_uncertainty.slice(0, 2)) {
    factual_delta.push("Previously uncertain area received clarification");
    void id;
  }
  for (const line of what_changed.slice(0, 3)) {
    if (!factual_delta.some((d) => d === line)) factual_delta.push(line);
  }
  if (factual_delta.length === 0) {
    factual_delta.push("No new factual changes since last comprehension point");
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
      const domains = worsening.map((c) => c.domain.replace(/_/g, " ")).join(" and ");
      directional_change.push(`Multiple areas showing concerning signals: ${domains}`);
    } else if (worsening.length === 1) {
      directional_change.push(
        `${worsening[0]!.domain.replace(/_/g, " ")} showing concerning signals`,
      );
    }
    if (improving.length > 0 && worsening.length === 0) {
      const domains = improving.map((c) => c.domain.replace(/_/g, " ")).join(" and ");
      directional_change.push(`Positive signals in: ${domains}`);
    }
    if (newDomains.length >= 2) {
      const domains = newDomains.map((c) => c.domain.replace(/_/g, " ")).join(" and ");
      directional_change.push(`New observations across: ${domains}`);
    }
  }

  // Fallback: signal counting
  if (directional_change.length === 0) {
    const recentText = activeEvents.slice(-8).map((e) => e.raw_input).join(" ");
    const improvementCount = activeEvents.filter((e) => IMPROVEMENT_SIGNALS.test(e.raw_input)).length;
    const deteriorationCount = activeEvents.filter((e) => DETERIORATION_SIGNALS.test(e.raw_input)).length;

    if (behavior.behavioral_change_detected) {
      directional_change.push("Behavioral pattern shift detected in recent period");
    }
    if (deteriorationCount > improvementCount) {
      directional_change.push("Available signals suggest deterioration or increased care needs");
    } else if (improvementCount > deteriorationCount && deteriorationCount === 0) {
      directional_change.push("Available signals suggest improvement or stabilization");
    }
    for (const pattern of input.multi_caregiver?.conflict_log.slice(-2) ?? []) {
      directional_change.push(pattern.shared_abstract_message);
    }
    if (DETERIORATION_SIGNALS.test(recentText) && directional_change.length === 0) {
      directional_change.push("Recent observations include deterioration indicators");
    }
  }

  const newly_important: string[] = [];
  if (input.attention_event_ids.length > 0) {
    newly_important.push(`${input.attention_event_ids.length} item(s) elevated to attention priority`);
  }
  if (behavior.escalation.risk_elevation === "high") {
    newly_important.push("Safety-related escalation signals newly elevated");
  }
  for (const risk of input.multi_caregiver?.shared_reality.active_risks.slice(0, 2) ?? []) {
    newly_important.push(risk);
  }
  for (const gap of continuity_decay.continuity_gaps.filter((g) => g.importance === "high").slice(0, 2)) {
    newly_important.push(`New continuity gap: ${gap.label}`);
  }

  const lost_confidence: string[] = [];
  for (const stale of continuity_decay.stale_items.slice(0, 3)) {
    lost_confidence.push(
      `${stale.label} confidence decreased (${stale.stale_reason})`,
    );
  }
  for (const [domain, score] of Object.entries(
    input.multi_caregiver?.shared_reality.confidence_map ?? {},
  )) {
    if (score < 0.5) {
      lost_confidence.push(`${domain} confidence reduced due to conflicting inputs`);
    }
  }
  if (continuity_decay.family_rhythm.meaningful_gap) {
    const days = continuity_decay.family_rhythm.days_since_last_update;
    lost_confidence.push(`Continuity confidence decreased — no update in ${days} day(s)`);
  }

  const stabilized: string[] = [];
  if (state_diff.resolved_uncertainty.length > 0) {
    stabilized.push("Some previously uncertain areas are now clarified");
  }
  if (what_changed.length === 0 && events_created.length === 0) {
    stabilized.push("No changes in core care domains since last review");
  }
  if (input.state_of_care?.sections.what_is_stable.length) {
    for (const line of input.state_of_care.sections.what_is_stable.slice(0, 2)) {
      if (!stabilized.includes(line)) stabilized.push(line);
    }
  }

  const system_interpretation: string[] = [];
  if (input.state_of_care) {
    system_interpretation.push(
      `Current focus: ${input.state_of_care.what_matters_most}`,
    );
  }

  // Use semantic trajectory summary when available
  if (care_state_change_report?.trajectory_summary) {
    system_interpretation.push(care_state_change_report.trajectory_summary);
  } else if (directional_change.length > 0 && newly_important.length > 0) {
    system_interpretation.push(
      "Overall care stability may be decreasing due to compounding recent changes",
    );
  } else if (what_changed.length === 0 && events_created.length === 0) {
    system_interpretation.push("Care context appears stable relative to last comprehension point");
  } else if (directional_change.length > 0 && /improvement|stabilization/i.test(directional_change.join(" "))) {
    system_interpretation.push("Recent changes suggest cautious improvement or stabilization");
  } else {
    system_interpretation.push("Care context updated — review attention items and next steps");
  }

  if (priorComprehendedAt) {
    const days = daysBetween(priorComprehendedAt, input.as_of ?? new Date().toISOString());
    if (days >= 3 && directional_change.length === 0) {
      system_interpretation.push(`No directional shift detected over the past ${days} day(s)`);
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
  return safetyFirst[0] ?? "No significant change detected";
}

export function deriveTimeFrame(
  priorComprehendedAt: string | null,
  asOf: string,
): { time_frame: string; relative_to: string } {
  if (!priorComprehendedAt) {
    return {
      time_frame: "since care context initialization",
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
  return { time_frame: "since last meaningful change", relative_to: priorComprehendedAt };
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
