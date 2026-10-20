import {
  DECISION_PATTERNS,
  DID_NOT_HELP_PATTERNS,
  HELPED_PATTERNS,
  ROUTINE_PATTERNS,
} from "./contract-constants";
import type { CareRealityProfile, ProfileEntry, ProfileSectionKey } from "./types";
import type { CanonicalCareEvent } from "../situation-entry/types";
import type { ProcessCareRealityProfileInput } from "./types";

function emptySections(): Record<ProfileSectionKey, ProfileEntry[]> {
  return {
    baseline_reality: [],
    important_routines: [],
    known_changes: [],
    previous_decisions: [],
    what_helped: [],
    what_did_not_help: [],
    family_observations: [],
    unresolved_questions: [],
  };
}

function entryFromEvent(
  event: CanonicalCareEvent,
  stage: ProfileEntry["evolution_stage"] = "fact",
): ProfileEntry {
  return {
    label: event.raw_input.slice(0, 150),
    source_event_ids: [event.id],
    observed_at: event.ingestion_time,
    confidence: event.uncertainty.length > 0 ? "low" : "medium",
    evolution_stage: stage,
  };
}

function classifyEvent(event: CanonicalCareEvent): ProfileSectionKey | null {
  const text = event.raw_input;
  if (HELPED_PATTERNS.some((p) => p.test(text))) return "what_helped";
  if (DID_NOT_HELP_PATTERNS.some((p) => p.test(text))) return "what_did_not_help";
  if (DECISION_PATTERNS.some((p) => p.test(text))) return "previous_decisions";
  if (ROUTINE_PATTERNS.some((p) => p.test(text))) return "important_routines";
  if (/\b(daughter|son|spouse|family|caregiver|noticed|observed)\b/i.test(text)) {
    return "family_observations";
  }
  if (/\b(changed|new|started|worse|declin|different)\b/i.test(text)) return "known_changes";
  return null;
}

export function buildCareRealityProfile(input: ProcessCareRealityProfileInput): CareRealityProfile {
  const asOf = input.as_of ?? new Date().toISOString();
  const sections = emptySections();
  const relationship_insights: string[] = [];

  for (const fact of input.baseline?.baseline_facts ?? []) {
    sections.baseline_reality.push({
      label: fact.label,
      source_event_ids: fact.source_event_ids,
      observed_at: fact.last_observed_at,
      confidence: fact.confidence,
      evolution_stage: fact.observation_count >= 3 ? "pattern" : "context",
    });
  }

  const activeEvents = input.all_events.filter(
    (e) => e.status !== "invalidated" && e.status !== "superseded",
  );

  for (const event of activeEvents) {
    const section = classifyEvent(event);
    if (section) {
      sections[section].push(entryFromEvent(event, "context"));
    }
  }

  for (const pattern of input.behavior?.longitudinal_patterns ?? []) {
    sections.known_changes.push({
      label: pattern.label,
      source_event_ids: [],
      observed_at: asOf,
      confidence: pattern.confidence === "high" ? "high" : "medium",
      evolution_stage: "pattern",
    });
    if (pattern.occurs_after.length > 0 || pattern.occurs_before.length > 0) {
      relationship_insights.push(
        `${pattern.label} — occurs after: ${pattern.occurs_after.join(", ") || "unknown"}`,
      );
    }
  }

  for (const q of input.what_needs_clarification) {
    sections.unresolved_questions.push({
      label: q,
      source_event_ids: [],
      observed_at: asOf,
      confidence: "low",
      evolution_stage: "fact",
    });
  }

  for (const u of input.what_is_uncertain) {
    sections.unresolved_questions.push({
      label: u,
      source_event_ids: [],
      observed_at: asOf,
      confidence: "low",
      evolution_stage: "fact",
    });
  }

  for (const fact of input.memory_strategy?.explainable_facts ?? []) {
    if (fact.tier === "long_lived" || fact.tier === "permanent") {
      sections.baseline_reality.push({
        label: fact.label,
        source_event_ids: fact.source_event_ids ?? [],
        observed_at: asOf,
        confidence: fact.confidence_pct >= 70 ? "high" : "medium",
        evolution_stage: "understanding",
      });
    }
  }

  const dedupe = (entries: ProfileEntry[]) => {
    const seen = new Set<string>();
    return entries.filter((e) => {
      const key = e.label.slice(0, 80);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  for (const key of Object.keys(sections) as ProfileSectionKey[]) {
    sections[key] = dedupe(sections[key]).slice(0, 8);
  }

  const baselineCount = sections.baseline_reality.length;
  const changeCount = sections.known_changes.length;
  const person_specific_summary =
    baselineCount > 0
      ? `Profile built from ${baselineCount} baseline signal(s) and ${changeCount} recorded change(s) for this person.`
      : "Profile forming — add observations to establish what is normal for this person.";

  return {
    care_recipient_id: input.care_recipient_id,
    computed_at: asOf,
    sections,
    relationship_insights: relationship_insights.slice(0, 5),
    person_specific_summary,
  };
}
