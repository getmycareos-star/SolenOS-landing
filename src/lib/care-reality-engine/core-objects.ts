/**
 * Phase 3 — Core Care Reality objects (MVP minimum spine).
 * Documents are evidence. Action ≠ Outcome. Supporting layers emerge from relationships.
 */

export type CareRealityEvent = {
  id: string;
  type: string;
  date: string;
  description: string;
  source: string;
  related_situation_id: string | null;
  contributor_id: string | null;
};

export type CareRealityObservation = {
  id: string;
  description: string;
  contributor_id: string;
  date: string;
  /** Epistemic stance — observation is not automatic fact. */
  confidence: "low" | "medium" | "high";
  source: string;
  related_situation_id: string | null;
};

export type CareRealityDecision = {
  id: string;
  decision: string;
  date: string;
  participants: string[];
  reason: string | null;
  evidence: string[];
  alternatives: string[];
  outcome: string | null;
  status: "active" | "superseded" | "unknown";
};

/** Something someone did — not a choice (Decision) and not a result (Outcome). */
export type CareRealityAction = {
  id: string;
  description: string;
  who: string | null;
  date: string;
  source: string;
  contributor_id: string | null;
  related_situation_id: string | null;
  related_decision_id: string | null;
};

export type CareRealityOutcome = {
  id: string;
  result: string;
  date: string;
  evidence: string[];
  related_decision_id: string | null;
  related_situation_id: string | null;
};

export type CareRealityUnknown = {
  id: string;
  question: string;
  why_it_matters: string;
  related_situation_id: string | null;
};

export type CareRealityCoreBundle = {
  events: CareRealityEvent[];
  observations: CareRealityObservation[];
  decisions: CareRealityDecision[];
  actions: CareRealityAction[];
  outcomes: CareRealityOutcome[];
  unknowns: CareRealityUnknown[];
};

export function emptyCoreBundle(): CareRealityCoreBundle {
  return {
    events: [],
    observations: [],
    decisions: [],
    actions: [],
    outcomes: [],
    unknowns: [],
  };
}
