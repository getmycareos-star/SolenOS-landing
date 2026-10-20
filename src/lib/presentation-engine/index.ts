/**
 * Presentation Engine — PURE projection over a single shared CareContext.
 * Never mutates facts, events, unknowns, confidence, or timeline order.
 */

export const PRESENTATION_MODES = ["essential", "standard", "detailed"] as const;
export type PresentationMode = (typeof PRESENTATION_MODES)[number];

export type PresentationPreference = {
  mode: PresentationMode;
  /** Optional role hint for future institutional projection — does NOT change truth. */
  actor_role?:
    | "primary_caregiver"
    | "secondary_caregiver"
    | "professional_caregiver"
    | "clinician"
    | "institutional_observer";
};

export type ContinuityTruthSlice = {
  what_changed: string[];
  what_is_happening: string[];
  what_needs_attention: string[];
  what_is_stable: string[];
  known: string[];
  inferred: string[];
  explicit_unknowns: Array<{
    missing_information: string;
    priority: string;
    reason_it_matters: string;
  }>;
  confidence_notes: string[];
  evidence_summaries: string[];
};

export type PresentedContinuityView = {
  mode: PresentationMode;
  /** Same underlying reality — filtered for cognitive load only. */
  sections: {
    what_changed: string[];
    what_matters_now: string[];
    what_is_unknown: string[];
    next_considerations: string[];
    reasoning_summary: string[];
    full_detail?: ContinuityTruthSlice;
  };
  invariants: {
    single_care_context: true;
    presentation_only: true;
    does_not_mutate_truth: true;
  };
};

/**
 * Cognitive load estimation — how many items can caregiver reasonably process?
 */
function estimateCognitiveLoad(truth: ContinuityTruthSlice): "low" | "medium" | "high" {
  const item_count =
    truth.what_changed.length +
    truth.what_is_happening.length +
    truth.what_needs_attention.length +
    truth.explicit_unknowns.length;

  if (item_count > 10) return "high";
  if (item_count > 5) return "medium";
  return "low";
}

/**
 * Deterministic, reversible, non-destructive renderer.
 */
export function projectPresentation(
  truth: ContinuityTruthSlice,
  preference: PresentationPreference = { mode: "standard" },
): PresentedContinuityView {
  const mode = preference.mode;
  const load = estimateCognitiveLoad(truth);
  const highUnknowns = truth.explicit_unknowns.filter(
    (u) => u.priority === "critical" || u.priority === "high",
  );
  const criticalItems = truth.what_needs_attention.filter(
    (item) => item.toLowerCase().includes("urgent") || 
              item.toLowerCase().includes("crisis") ||
              item.toLowerCase().includes("immediate")
  );

  if (mode === "essential") {
    // ESSENTIAL MODE: Headlines only
    // Target: Overwhelmed caregiver, immediate decisions only
    return {
      mode,
      sections: {
        what_changed: truth.what_changed.slice(0, 1),
        what_matters_now: (criticalItems.length > 0 ? criticalItems : truth.what_needs_attention).slice(0, 1),
        what_is_unknown: highUnknowns.slice(0, 1).map((u) => u.missing_information),
        next_considerations: (criticalItems.length > 0 ? criticalItems : truth.what_needs_attention).slice(0, 1),
        reasoning_summary: [],
      },
      invariants: {
        single_care_context: true,
        presentation_only: true,
        does_not_mutate_truth: true,
      },
    };
  }

  if (mode === "detailed") {
    // DETAILED MODE: Full picture with reasoning
    // Target: Professional caregiver, clinic staff, comprehensive understanding
    return {
      mode,
      sections: {
        what_changed: truth.what_changed,
        what_matters_now: [
          ...truth.what_is_happening.slice(0, 4),
          ...truth.what_needs_attention.slice(0, 4),
        ],
        what_is_unknown: truth.explicit_unknowns.map(
          (u) => `${u.missing_information} (${u.priority}): ${u.reason_it_matters}`,
        ),
        next_considerations: truth.what_needs_attention,
        reasoning_summary: [
          ...truth.inferred,
          ...truth.confidence_notes,
          ...truth.evidence_summaries,
        ],
        full_detail: truth,
      },
      invariants: {
        single_care_context: true,
        presentation_only: true,
        does_not_mutate_truth: true,
      },
    };
  }

  // STANDARD MODE: Balanced presentation (default)
  // Target: Regular caregiver, everyday use
  return {
    mode: "standard",
    sections: {
      what_changed: truth.what_changed.slice(0, 3),
      what_matters_now: truth.what_needs_attention.slice(0, 3),
      what_is_unknown: highUnknowns.slice(0, 2).map(
        (u) => `${u.missing_information} — ${u.reason_it_matters}`,
      ),
      next_considerations: truth.what_needs_attention.slice(0, 2),
      reasoning_summary: [
        ...truth.confidence_notes.slice(0, 2),
        ...truth.evidence_summaries.slice(0, 2),
        ],
        full_detail: truth,
      },
      invariants: {
        single_care_context: true,
        presentation_only: true,
        does_not_mutate_truth: true,
      },
    };
  }

  // standard (default)
