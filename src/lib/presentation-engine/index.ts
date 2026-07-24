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
 * Deterministic, reversible, non-destructive renderer.
 */
export function projectPresentation(
  truth: ContinuityTruthSlice,
  preference: PresentationPreference = { mode: "standard" },
): PresentedContinuityView {
  const mode = preference.mode;
  const highUnknowns = truth.explicit_unknowns.filter(
    (u) => u.priority === "critical" || u.priority === "high",
  );

  if (mode === "essential") {
    return {
      mode,
      sections: {
        what_changed: truth.what_changed.slice(0, 2),
        what_matters_now: truth.what_needs_attention.slice(0, 2),
        what_is_unknown: highUnknowns.slice(0, 2).map((u) => u.missing_information),
        next_considerations: truth.what_needs_attention.slice(0, 1),
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

  // standard (default)
  return {
    mode: "standard",
    sections: {
      what_changed: truth.what_changed.slice(0, 4),
      what_matters_now: truth.what_is_happening.slice(0, 3),
      what_is_unknown: highUnknowns.slice(0, 3).map((u) => u.missing_information),
      next_considerations: truth.what_needs_attention.slice(0, 3),
      reasoning_summary: truth.inferred.slice(0, 2),
    },
    invariants: {
      single_care_context: true,
      presentation_only: true,
      does_not_mutate_truth: true,
    },
  };
}
