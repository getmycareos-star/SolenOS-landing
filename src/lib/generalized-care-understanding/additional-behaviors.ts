/**
 * Additional SolenOS intelligence behaviors (1–15).
 * General reasoning principles — never keyword/scenario product branches.
 *
 * SoT: docs/02-product/solenos-generalized-care-understanding.md
 */

import type { CareRealityExtractionResult } from "../care-reality-extraction";
import { classifyEpistemicClaim } from "../care-epistemics";
import { rankEvidenceSource } from "../care-reality-engine/evidence-priority";
import type { CareSignalUnderstandingResult } from "../care-signal-understanding";

/** Minimal base shape — avoids circular import with index.ts */
export type AdditionalBehaviorsBaseInput = {
  open_loops: Array<{ question: string }>;
  epistemic: { observed: string[]; derived: string[]; unknown: string[] };
  requires_attention_now: string | null;
  useful_background: string[];
  caregiver_capacity_context: string | null;
};
export const ADDITIONAL_INTELLIGENCE_BEHAVIORS = [
  "context_reconstruction",
  "contradiction_detection",
  "recency_awareness",
  "escalation_awareness",
  "caregiver_workload_modeling",
  "information_reliability",
  "source_attribution",
  "decision_readiness",
  "outcome_tracking",
  "memory_importance_filtering",
  "personalization_through_history",
  "why_does_this_matter",
  "avoid_cognitive_overload",
  "confidence_calibration",
  "continuous_learning_loop",
] as const;

export type AdditionalIntelligenceBehavior =
  (typeof ADDITIONAL_INTELLIGENCE_BEHAVIORS)[number];

export type InferenceConfidence = "high" | "medium" | "low";

export type MemoryImportance = "temporary" | "important" | "long_term";

export type AdditionalIntelligenceBehaviorsResult = {
  behaviors_applied: readonly AdditionalIntelligenceBehavior[];
  /** Who / situation / time / new-ongoing-resolved / prior links — engine notes. */
  context_reconstruction: {
    who_involved: string | null;
    situation_described: string | null;
    time_period_hint: string | null;
    lifecycle: "new" | "ongoing" | "resolved_signal" | "unclear";
    connects_to_prior: boolean;
  };
  /** Conflict with prior — preserve both; never silent overwrite. */
  contradiction: {
    detected: boolean;
    previous_understanding: string | null;
    new_information: string | null;
    current_interpretation: string | null;
  };
  recency: {
    favors_recent: boolean;
    note: string | null;
  };
  escalation: {
    complexity_increasing: boolean;
    related_signal_count: number;
    note: string | null;
  };
  workload: {
    unresolved_concern_count: number;
    load_context_present: boolean;
    note: string | null;
  };
  reliability: {
    source_kind: "caregiver_observation" | "reported" | "document" | "inferred" | "mixed";
    note: string | null;
  };
  attribution: {
    contributor_id: string | null;
    observed_or_reported: "observed" | "reported" | "mixed" | "unknown";
    as_of: string;
  };
  decision_readiness: {
    ready: boolean;
    missing_first: string[];
    note: string | null;
  };
  outcome_tracking: {
    has_event: boolean;
    has_response_action: boolean;
    has_outcome: boolean;
    incomplete: boolean;
    note: string | null;
  };
  memory_filter: {
    importance: MemoryImportance;
    note: string | null;
  };
  personalization: {
    uses_prior_history: boolean;
    note: string | null;
  };
  why_it_matters: string | null;
  cognitive_overload: {
    show_selectively: true;
    primary_focus: string | null;
    deferred: string[];
  };
  confidence: {
    observed_band: InferenceConfidence;
    derived_band: InferenceConfidence;
    unknowns_remain_visible: true;
  };
  continuous_learning: {
    updates_care_record: true;
    note: string;
  };
};

function timePeriodHint(text: string): string | null {
  const m = text.match(
    /\b(?:yesterday|today|this morning|last night|last week|this week|last month|days? ago|over the last[^.!]{0,40})\b/i,
  );
  return m ? m[0]! : null;
}

function lifecycleFromExtraction(
  extraction: CareRealityExtractionResult,
  priorHeld: string[],
): "new" | "ongoing" | "resolved_signal" | "unclear" {
  if (extraction.outcomes.length > 0 && /improv|better|resolv/i.test(
    extraction.outcomes.map((o) => o.description).join(" "),
  )) {
    return "resolved_signal";
  }
  if (priorHeld.length > 0) return "ongoing";
  if (
    extraction.observations.length +
      extraction.events.length +
      extraction.decisions.length >
    0
  ) {
    return "new";
  }
  return "unclear";
}

function looksLikeConflictWithPrior(raw: string, prior: string[]): boolean {
  if (prior.length === 0) return false;
  // Structural: negation / change discourse against held story — not noun lists.
  const changeVsPrior =
    /\b(?:no longer|not anymore|instead|now|changed|stopped|started|different)\b/i.test(
      raw,
    );
  return changeVsPrior && prior.some((p) => p.trim().length > 12);
}

function sourceKind(
  raw: string,
  extraction: CareRealityExtractionResult,
): AdditionalIntelligenceBehaviorsResult["reliability"]["source_kind"] {
  const rank = rankEvidenceSource(raw);
  if (rank === "clinical_documentation" || rank === "care_professional_notes") {
    return "document";
  }  const claims = [
    ...extraction.observations.map((o) => o.raw_fragment),
    raw,
  ];
  let observed = 0;
  let reported = 0;
  for (const c of claims) {
    const k = classifyEpistemicClaim(c);
    if (k === "observable_observation") observed += 1;
    else if (k === "caregiver_interpretation") reported += 1;
    else if (k === "mixed") {
      observed += 1;
      reported += 1;
    }
  }
  if (observed > 0 && reported > 0) return "mixed";
  if (reported > observed) return "reported";
  if (observed > 0) return "caregiver_observation";
  if (extraction.unknowns.length > 0 && extraction.observations.length === 0) {
    return "inferred";
  }
  return "caregiver_observation";
}

/**
 * Apply additional intelligence behaviors on top of core generalized understanding.
 */
export function processAdditionalIntelligenceBehaviors(params: {
  raw_input: string;
  contributor_id?: string;
  prior_held?: string[];
  as_of?: string;
  base: AdditionalBehaviorsBaseInput;
  extraction: CareRealityExtractionResult;
  care_signal: CareSignalUnderstandingResult;
}): AdditionalIntelligenceBehaviorsResult {
  const raw = params.raw_input;
  const prior = params.prior_held ?? [];
  const { extraction, care_signal: csl, base } = params;
  const as_of = params.as_of ?? new Date().toISOString();

  const signalCount =
    extraction.observations.length +
    extraction.events.length +
    extraction.decisions.length +
    extraction.outcomes.length;
  const complexity_increasing = signalCount >= 3 || (prior.length > 0 && signalCount >= 2);

  const conflict = looksLikeConflictWithPrior(raw, prior);
  const unresolved = base.open_loops.length + base.epistemic.unknown.length;

  const ready =
    unresolved === 0 &&
    extraction.decisions.every((d) => !d.reason_unknown) &&
    base.epistemic.unknown.length === 0;

  const has_event = extraction.events.length > 0;
  const has_response_action = extraction.actions.length > 0;
  const has_outcome = extraction.outcomes.length > 0;

  let importance: MemoryImportance = "temporary";
  if (
    extraction.decisions.length > 0 ||
    extraction.events.length > 0 ||
    prior.length > 0
  ) {
    importance = "important";
  }
  if (prior.length >= 3 && (extraction.decisions.length > 0 || extraction.events.length > 0)) {
    importance = "long_term";
  }
  if (
    raw.trim().length < 40 &&
    signalCount === 0 &&
    !csl.caregiver_burden_context
  ) {
    importance = "temporary";
  }

  const why =
    base.requires_attention_now ??
    (base.epistemic.unknown[0]
      ? "Reduces uncertainty in the care situation."
      : prior.length > 0
        ? "Connects to what is already held in the care story."
        : "Helps form the current care understanding.");

  const observed_band: InferenceConfidence =
    base.epistemic.observed.length > 0 ? "high" : "low";
  const derived_band: InferenceConfidence =
    base.epistemic.derived.length === 0
      ? "low"
      : base.epistemic.unknown.length > 0
        ? "low"
        : "medium";

  const reliability = sourceKind(raw, extraction);
  const observed_or_reported =
    reliability === "caregiver_observation"
      ? "observed"
      : reliability === "reported"
        ? "reported"
        : reliability === "mixed"
          ? "mixed"
          : "unknown";

  return {
    behaviors_applied: ADDITIONAL_INTELLIGENCE_BEHAVIORS,
    context_reconstruction: {
      who_involved: params.contributor_id ?? null,
      situation_described: csl.care_state_understanding,
      time_period_hint: timePeriodHint(raw),
      lifecycle: lifecycleFromExtraction(extraction, prior),
      connects_to_prior: prior.length > 0,
    },
    contradiction: {
      detected: conflict,
      previous_understanding: conflict ? prior[0] ?? null : null,
      new_information: conflict ? raw.trim().slice(0, 240) : null,
      current_interpretation: conflict
        ? "Both previous understanding and new information are kept — confirmation may be needed."
        : null,
    },
    recency: {
      favors_recent: true,
      note: timePeriodHint(raw)
        ? "Time cues in this input inform how current the situation is."
        : prior.length > 0
          ? "Recent input is weighed against older held understanding."
          : null,
    },
    escalation: {
      complexity_increasing,
      related_signal_count: signalCount,
      note: complexity_increasing
        ? "Multiple related care signals increase attention needed — not a medical conclusion."
        : null,
    },
    workload: {
      unresolved_concern_count: unresolved,
      load_context_present: Boolean(base.caregiver_capacity_context),
      note:
        unresolved >= 3
          ? "Several unresolved concerns increase caregiver pressure beyond simple task count."
          : base.caregiver_capacity_context,
    },
    reliability: {
      source_kind: reliability,
      note:
        reliability === "reported"
          ? "This includes reported information — distinct from direct observation."
          : reliability === "document"
            ? "Clinical or document evidence is held with source priority."
            : null,
    },
    attribution: {
      contributor_id: params.contributor_id ?? null,
      observed_or_reported,
      as_of,
    },
    decision_readiness: {
      ready,
      missing_first: ready
        ? []
        : base.epistemic.unknown.slice(0, 3).concat(
            base.open_loops.map((l) => l.question).slice(0, 2),
          ).slice(0, 3),
      note: ready
        ? "Enough clarity to prepare a next understanding step."
        : "Missing information should be clarified before recommending action.",
    },
    outcome_tracking: {
      has_event,
      has_response_action,
      has_outcome,
      incomplete: (has_event || extraction.decisions.length > 0) && !has_outcome,
      note:
        (has_event || extraction.decisions.length > 0) && !has_outcome
          ? "Event or decision is held; outcome afterward is not yet known."
          : null,
    },
    memory_filter: {
      importance,
      note:
        importance === "temporary"
          ? "Held lightly unless it connects to change, decision, or pattern."
          : importance === "long_term"
            ? "Belongs with established care history."
            : "Meaningful change or decision — keep in the care story.",
    },
    personalization: {
      uses_prior_history: prior.length > 0,
      note: prior.length > 0
        ? "Interpretation uses this person's held history — not generic assumptions."
        : "Little prior history yet; avoid generic population assumptions.",
    },
    why_it_matters: why,
    cognitive_overload: {
      show_selectively: true,
      primary_focus: base.requires_attention_now,
      deferred: base.useful_background.slice(0, 3),
    },
    confidence: {
      observed_band,
      derived_band,
      unknowns_remain_visible: true,
    },
    continuous_learning: {
      updates_care_record: true,
      note: "This input updates understanding for future interpretation of the same care journey.",
    },
  };
}
