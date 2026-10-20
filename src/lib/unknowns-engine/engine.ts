import { getClinicalUnknownsProfile, DEFAULT_CLINICAL_PROFILE_ID } from "./profiles";
import type {
  ExplicitUnknown,
  ExplicitUnknownsProjection,
  UnknownPriority,
} from "./types";

let unknownSeq = 0;

function nextId(): string {
  unknownSeq += 1;
  return `unk_${Date.now()}_${unknownSeq}`;
}

/**
 * Disease-agnostic Unknowns Engine.
 * Clinical domains are profiles only — never hardcoded in this function.
 */
export function deriveExplicitUnknowns(input: {
  known: string[];
  inferred: string[];
  event_texts: string[];
  unresolved_clarifications: string[];
  conflict_count?: number;
  related_care_event_ids?: string[];
  /** Defaults to dementia MVP profile; pass "parkinsons" etc. later. */
  clinical_profile_id?: string;
}): ExplicitUnknownsProjection {
  const profile = getClinicalUnknownsProfile(
    input.clinical_profile_id ?? DEFAULT_CLINICAL_PROFILE_ID,
  );
  const corpus = input.event_texts.join(" \n ");
  const unknowns: ExplicitUnknown[] = [];
  const seen = new Set<string>();
  const eventIds = input.related_care_event_ids ?? [];

  for (const rule of profile.rules) {
    if (!rule.trigger_pattern.test(corpus)) continue;
    if (rule.resolved_pattern?.test(corpus)) continue;
    if (seen.has(rule.missing_information)) continue;
    seen.add(rule.missing_information);

    unknowns.push({
      unknown_id: nextId(),
      category: rule.category,
      field_name: rule.missing_information,
      missing_information: rule.missing_information,
      reason_it_matters: rule.reason_it_matters,
      why_it_matters: rule.reason_it_matters,
      clinical_or_operational_impact: rule.clinical_or_operational_impact,
      impact_if_known: rule.clinical_or_operational_impact,
      priority: rule.priority,
      confidence_impact: rule.confidence_impact,
      related_care_events: eventIds.slice(-5),
      related_entities: [],
      status: "unresolved",
      derived_from: "clinical_gap",
      clarification_question: rule.clarification_question,
    });
  }

  for (const q of input.unresolved_clarifications.slice(0, 4)) {
    const key = `clarification:${q.slice(0, 40)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unknowns.push({
      unknown_id: nextId(),
      category: "clarification",
      field_name: q.slice(0, 80),
      missing_information: q.slice(0, 80),
      reason_it_matters: "Unresolved clarification blocks safer understanding",
      why_it_matters: "Unresolved clarification blocks safer understanding",
      clinical_or_operational_impact: "Reduces clarification load and uncertainty density",
      impact_if_known: "Reduces clarification load and uncertainty density",
      priority: "high",
      confidence_impact: "material",
      related_care_events: eventIds.slice(-3),
      related_entities: [],
      status: "unresolved",
      derived_from: "missing_field",
      clarification_question: q,
    });
  }

  if ((input.conflict_count ?? 0) > 0) {
    unknowns.push({
      unknown_id: nextId(),
      category: "contradiction",
      field_name: "contradiction_resolution",
      missing_information: "contradiction_resolution",
      reason_it_matters: "Conflicting reports exist — system must not silently pick one",
      why_it_matters: "Conflicting reports exist — system must not silently pick one",
      clinical_or_operational_impact: "Restores trust and raises global confidence",
      impact_if_known: "Restores trust and raises global confidence",
      priority: "critical",
      confidence_impact: "blocks_recommendation",
      related_care_events: eventIds.slice(-5),
      related_entities: [],
      status: "unresolved",
      derived_from: "conflict",
      clarification_question:
        "Which observation should we treat as more recent or more reliable for this conflict?",
    });
  }

  if (input.event_texts.length > 0 && input.event_texts.length < 2) {
    unknowns.push({
      unknown_id: nextId(),
      category: "timeline",
      field_name: "baseline_comparison",
      missing_information: "baseline_comparison",
      reason_it_matters: "Insufficient longitudinal events to judge change",
      why_it_matters: "Insufficient longitudinal events to judge change",
      clinical_or_operational_impact: "Enables Diff Engine and progression visibility",
      impact_if_known: "Enables Diff Engine and progression visibility",
      priority: "medium",
      confidence_impact: "improves_confidence",
      related_care_events: eventIds,
      related_entities: [],
      status: "unresolved",
      derived_from: "incomplete_timeline",
      clarification_question: "What was typical before this recent change?",
    });
  }

  const priorityRank: Record<UnknownPriority, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  unknowns.sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]);

  return {
    known: input.known.slice(0, 8),
    inferred: input.inferred.slice(0, 6),
    explicit_unknowns: unknowns.slice(0, 10),
    clinical_profile_id: profile.profile_id,
  };
}

/** Max 1–2 clarifications unless caregiver opts in for more. */
export function clarificationTargetsFromUnknowns(
  unknowns: ExplicitUnknown[],
  maxQuestions = 2,
): ExplicitUnknown[] {
  return unknowns
    .filter((u) => u.status === "unresolved")
    .filter((u) => u.priority === "critical" || u.priority === "high")
    .slice(0, maxQuestions);
}

export function questionsFromUnknowns(unknowns: ExplicitUnknown[], maxQuestions = 2): string[] {
  return clarificationTargetsFromUnknowns(unknowns, maxQuestions)
    .map((u) => u.clarification_question)
    .filter((q): q is string => Boolean(q?.trim()));
}
