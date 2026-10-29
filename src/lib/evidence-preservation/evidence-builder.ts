/**
 * Evidence Builder.
 *
 * This module assembles references; it does not verify source truth or assign
 * confidence. Only persisted event IDs supplied by the caller may be linked.
 */

import type {
  ActionState,
  InterpretedState,
  PriorityState,
} from "../engine/domain/types";
import type { EvidenceObject, EvidencedConclusion, ObservationType } from "./index";
import { buildEvidenceObject, buildEvidencedConclusion } from "./index";

export interface EvidenceContext {
  /** IDs of existing care events; never synthetic IDs. */
  event_ids: string[];
  /** Source-backed temporal labels, not a paraphrase of an AI interpretation. */
  timeline_references: string[];
  /** Deprecated compatibility inputs; numeric values are not treated as calibrated evidence. */
  confidence_score?: number | null;
  source_reliability_score?: number | null;
  age_days?: number | null;
  contradiction_links?: string[];
  reasoning_summary: string;
  what_would_increase_confidence?: string[];
  /** Must be explicitly supplied by a source-aware stage; never inferred from a score. */
  epistemic_kind?: "direct_observation" | "caregiver_report" | "professional_observation" | "person_self_report" | "inference" | "hypothesis" | "unknown";
  observation_type?: ObservationType;
}

export interface EvidenceTraceContext {
  interpreted: InterpretedState;
  priority: PriorityState;
  actions: ActionState;
  evidence_pieces: EvidenceContext[];
}

/** Build a conclusion wrapper while keeping missing evidence visible. */
export function buildEvidenceForPriority(
  trace: EvidenceTraceContext,
  conclusion: string,
): EvidencedConclusion {
  const primary = trace.evidence_pieces[0];
  const evidence = buildEvidenceObject({
    event_ids: primary?.event_ids ?? [],
    timeline_labels: primary?.timeline_references ?? [],
    observation_type: primary?.observation_type ?? "unclassified",
    // Legacy numeric values are accepted only for API compatibility and are not emitted.
    confidence_score: primary?.confidence_score,
    source_reliability_score: primary?.source_reliability_score,
    age_days: primary?.age_days,
    contradiction_links: primary?.contradiction_links,
    reasoning_summary: primary?.reasoning_summary ??
      "No linked source evidence was provided. This conclusion has not been grounded or verified by this builder.",
    what_would_increase_confidence: primary?.what_would_increase_confidence ?? [
      "Link the original persisted evidence and care-event IDs.",
      "Record who reported or directly observed the event and when it occurred.",
      "Assess source independence, conflicting evidence, and task-specific sufficiency.",
    ],
  });

  return buildEvidencedConclusion({
    recommendation: conclusion,
    implied_action: trace.actions.actions.do_now[0] || null,
    evidence,
  });
}

/** Convert an explicit information gap into transparent clarification needs. */
export function buildEvidenceForUncertainty(
  reason_it_matters: string,
  could_be_clarified_by: string[],
): { missing_information: string; why_it_matters: string; next_steps: string[] } {
  return {
    missing_information: reason_it_matters,
    why_it_matters: "The available record does not establish this information; the effect depends on the care question being assessed.",
    next_steps: [...new Set(could_be_clarified_by.filter((item) => item.trim().length > 0))],
  };
}

/**
 * An interpretation is not itself a source record. This adapter deliberately
 * emits no synthetic event ID, source reliability, confidence, or timeline.
 */
export function collectEvidenceFromInterpretation(
  interpreted: InterpretedState,
): EvidenceContext {
  return {
    event_ids: [],
    timeline_references: [],
    epistemic_kind: "unknown",
    observation_type: "unclassified",
    reasoning_summary:
      "This is an interpretation of user input, not a persisted evidence record. Link source evidence before using it as a grounded care conclusion.",
    what_would_increase_confidence: [
      "Persist the original input as evidence and retain its exact source text.",
      "Attribute the reporter separately from the uploader and record event time when known.",
      "Review the extracted claim against its source passage before classifying it.",
    ],
  };
}

/**
 * Evidence count alone does not establish independence, quality, or sufficiency.
 * This legacy API therefore returns no numeric confidence and no count-based
 * truth judgment.
 */
export function ratifyPriorityWithEvidence(
  priority_classification: string,
  evidence_count: number,
): { conclusion: string; confidence: number | null } {
  const count = Number.isFinite(evidence_count) ? Math.max(0, Math.floor(evidence_count)) : 0;
  const classification = priority_classification.trim() || "unclassified priority";
  return {
    conclusion: count === 0
      ? `Insufficient linked evidence to assess ${classification}. Request clarification or link source records before making an evidence-grounded conclusion.`
      : `${count} evidence reference(s) are available for ${classification}; source independence, quality, conflict status, and sufficiency have not been established by item count.`,
    confidence: null,
  };
}

/** Explain the origin and limits of each evidence context without score thresholds. */
export function buildTransparencyAuditTrail(
  evidence_pieces: EvidenceContext[],
  priority: PriorityState,
  actions: ActionState,
): {
  understood_from: Record<string, string[]>;
  decision_factors: Record<string, string[]>;
  uncertainties_affecting_response: string[];
  could_be_clarified_by: string[];
} {
  const clarifications = evidence_pieces
    .flatMap((piece) => piece.what_would_increase_confidence ?? [])
    .filter((item) => typeof item === "string" && item.trim().length > 0);

  const byKind = (kind: NonNullable<EvidenceContext["epistemic_kind"]>) =>
    evidence_pieces.filter((piece) => piece.epistemic_kind === kind)
      .map((piece) => piece.reasoning_summary);

  return {
    understood_from: {
      direct_observation: byKind("direct_observation"),
      caregiver_report: byKind("caregiver_report"),
      professional_observation: byKind("professional_observation"),
      person_self_report: byKind("person_self_report"),
      inferred_from_pattern: byKind("inference"),
      hypothesis: byKind("hypothesis"),
      unclassified_or_unknown: byKind("unknown").concat(
        evidence_pieces.filter((piece) => !piece.epistemic_kind).map((piece) => piece.reasoning_summary),
      ),
    },
    decision_factors: {
      priority: priority.reasons,
      suggested_actions: actions.actions.do_now.slice(0, 3),
      follow_up: actions.actions.ask_professional.slice(0, 2),
    },
    uncertainties_affecting_response: evidence_pieces.map((piece) =>
      `No calibrated confidence is available for this evidence context: ${piece.reasoning_summary}`,
    ),
    could_be_clarified_by: [...new Set(clarifications)].slice(0, 5),
  };
}
