/**
 * Evidence Builder — integrates evidence tracking into the reasoning pipeline.
 * Connects extracted events, reasoning summary, and confidence scoring.
 */

import type {
  ActionState,
  InterpretedState,
  PriorityState,
} from "../engine/domain/types";
import type { EvidenceObject, EvidencedConclusion } from "./index";
import { buildEvidenceObject, buildEvidencedConclusion } from "./index";

export interface EvidenceContext {
  /** Event IDs extracted from the input — traceable back to raw care events */
  event_ids: string[];
  /** Timeline labels or natural language references to when things occurred */
  timeline_references: string[];
  /** How certain are we based on the evidence? */
  confidence_score: number;
  /** How reliable is the source? (caregiver direct, document, family report, hearsay, etc) */
  source_reliability_score: number;
  /** How old is the evidence? (days) */
  age_days?: number;
  /** IDs of events that contradict this conclusion */
  contradiction_links?: string[];
  /** What is the reasoning chain that led to this conclusion? */
  reasoning_summary: string;
  /** What additional information would strengthen our confidence? */
  what_would_increase_confidence?: string[];
}

export interface EvidenceTraceContext {
  interpreted: InterpretedState;
  priority: PriorityState;
  actions: ActionState;
  /** Pieces of evidence that informed this analysis */
  evidence_pieces: EvidenceContext[];
}

/**
 * Build evidence for the "what_matters_now" conclusion
 */
export function buildEvidenceForPriority(
  trace: EvidenceTraceContext,
  conclusion: string,
): EvidencedConclusion {
  const primary_evidence = trace.evidence_pieces[0];

  if (!primary_evidence) {
    // Fallback if no evidence pieces provided
    return buildEvidencedConclusion({
      recommendation: conclusion,
      evidence: buildEvidenceObject({
        event_ids: [],
        timeline_labels: [],
        confidence_score: 0.3,
        source_reliability_score: 0.5,
        reasoning_summary:
          "Based on the input provided, without specific event references.",
        what_would_increase_confidence: [
          "Confirm timing of reported events",
          "Clarify which caregiver observed each change",
        ],
      }),
    });
  }

  const evidence = buildEvidenceObject({
    event_ids: primary_evidence.event_ids,
    timeline_labels: primary_evidence.timeline_references,
    confidence_score: primary_evidence.confidence_score,
    source_reliability_score: primary_evidence.source_reliability_score,
    age_days: primary_evidence.age_days,
    contradiction_links: primary_evidence.contradiction_links,
    reasoning_summary: primary_evidence.reasoning_summary,
    what_would_increase_confidence:
      primary_evidence.what_would_increase_confidence,
  });

  return buildEvidencedConclusion({
    recommendation: conclusion,
    implied_action: trace.actions.actions.do_now[0] || null,
    evidence,
  });
}

/**
 * Build evidence for uncertainties and open questions
 */
export function buildEvidenceForUncertainty(
  reason_it_matters: string,
  could_be_clarified_by: string[],
): { missing_information: string; why_it_matters: string; next_steps: string[] } {
  return {
    missing_information: reason_it_matters,
    why_it_matters:
      "Understanding this would improve clarity about the current care situation.",
    next_steps: could_be_clarified_by,
  };
}

/**
 * Collect evidence context throughout pipeline execution.
 * Called by each stage that extracts new information.
 */
export function collectEvidenceFromInterpretation(
  interpreted: InterpretedState,
): EvidenceContext {
  return {
    event_ids: interpreted.context.patient ? ["event_from_input"] : [],
    timeline_references: [interpreted.interpretation.meaning],
    confidence_score: interpreted.uncertain_elements ? 0.6 : 0.8,
    source_reliability_score: 0.75, // Default user_note reliability
    reasoning_summary: `Extracted from input: ${interpreted.interpretation.meaning}`,
    what_would_increase_confidence: [
      "Confirm the timing of this observation",
      "Specify which family member observed this",
      "Clarify the current vs. previous state",
    ],
  };
}

/**
 * Convert priority classification into evidence-backed conclusion
 */
export function ratifyPriorityWithEvidence(
  priority_classification: string,
  evidence_count: number,
): { conclusion: string; confidence: number } {
  if (evidence_count === 0) {
    return {
      conclusion:
        "Insufficient evidence to determine priority — request clarification from caregiver.",
      confidence: 0.3,
    };
  }

  if (evidence_count === 1) {
    return {
      conclusion:
        priority_classification === "IMMEDIATE_ACTION"
          ? "Single source indicates immediate action needed."
          : "Single source suggests observation period.",
      confidence: 0.6,
    };
  }

  return {
    conclusion:
      priority_classification === "IMMEDIATE_ACTION"
        ? "Multiple sources align on urgent action."
        : "Evidence pattern suggests current approach is appropriate.",
    confidence: evidence_count >= 3 ? 0.85 : 0.75,
  };
}

/**
 * Build transparency audit trail — why this response was generated
 */
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
  const all_clarifications = evidence_pieces
    .flatMap((e) => e.what_would_increase_confidence || [])
    .filter(Boolean);

  return {
    understood_from: {
      direct_observation: evidence_pieces
        .filter((e) => e.source_reliability_score >= 0.8)
        .map((e) => e.reasoning_summary),
      inferred_from_pattern: evidence_pieces
        .filter((e) => e.source_reliability_score < 0.8)
        .map((e) => e.reasoning_summary),
    },
    decision_factors: {
      priority: priority.reasons,
      suggested_actions: actions.actions.do_now.slice(0, 3),
      follow_up: actions.actions.ask_professional.slice(0, 2),
    },
    uncertainties_affecting_response: evidence_pieces
      .filter((e) => e.confidence_score < 0.7)
      .map((e) => `Low confidence (${(e.confidence_score * 100).toFixed(0)}%): ${e.reasoning_summary}`),
    could_be_clarified_by: [...new Set(all_clarifications)].slice(0, 3),
  };
}
