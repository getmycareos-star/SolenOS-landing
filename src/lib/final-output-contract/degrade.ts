import type { FinalOutputContract } from "./types";
import type { CareTransparencyPanel } from "../care-transparency-layer/types";

export function createEmptyTransparencyPanel(): CareTransparencyPanel {
  return {
    data_used: { care_events: [], timeline_segments: [], caregiver_inputs: [] },
    data_ignored: { conflicting: [], low_confidence: [], stale_or_decayed: [] },
    reason_for_output: "Awaiting structured care input to produce traceable reasoning.",
    evidence_breakdown: [],
    confidence_scores: { overall_pct: 15, tier: "low" },
    recency: {
      last_update_at: null,
      critical_event_ages: [],
      decay_status: "stale",
    },
    observed: [],
    inferred: [],
  };
}

export function createEmptyDecisionTrace(): FinalOutputContract["decision_trace"] {
  return {
    events: [],
    assumptions: [],
    unknowns: [],
    evidence_sources: [],
  };
}

export function createEmptyTrustLayer(): FinalOutputContract["trust_layer"] {
  return {
    known: [],
    assumed: [],
    unknown: [{ statement: "Insufficient structure to surface explicit gaps", drives_clarification: true }],
    recency: {
      last_updated_at: null,
      freshness_score: 0,
      interpretation: "potentially outdated (>7–14 days)",
    },
    confidence: 0.15,
  };
}
export function createEmptyConfidenceState(): FinalOutputContract["confidence_state"] {
  return {
    overall_confidence: "low",
    completeness: 0,
    reasoning_limits: ["Insufficient structured information to interpret safely."],
  };
}

/** Degrade into uncertainty fields when output cannot be fully compiled. */
export function buildDegradedOutput(input: {
  partial_happening?: string;
  reason: string;
  questions?: string[];
  unknowns?: string[];
}): FinalOutputContract {
  const questions =
    input.questions && input.questions.length > 0
      ? input.questions.slice(0, 3).join(" ")
      : "What specifically is happening right now, and when did it start?";

  return {
    what_is_happening:
      input.partial_happening ??
      "The input does not yet have enough structure to interpret safely. Key details are still uncertain.",
    what_matters_now: "Unable to determine priority — add concrete facts before acting.",
    what_to_ask_next: questions,
    risk_level: "medium",
    what_can_wait:
      "Priority assessment until missing details are clarified. Absence of detail is not a signal of safety.",
    follow_up_items: [],
    decision_trace: {
      events: [],
      assumptions: [],
      unknowns: input.unknowns ?? [input.reason],
      evidence_sources: ["user input"],
    },
    confidence_state: {
      overall_confidence: "low",
      completeness: 0,
      reasoning_limits: [
        input.reason,
        "Cannot infer events, dates, or relationships without evidence.",
      ],
    },
    trust_layer: {
      known: [],
      assumed: [],
      unknown: (input.unknowns ?? [input.reason]).map((u) => ({
        statement: u,
        drives_clarification: true,
      })),
      recency: {
        last_updated_at: null,
        freshness_score: 0,
        interpretation: "potentially outdated (>7–14 days)",
      },
      confidence: 0.2,
    },
    transparency_panel: createEmptyTransparencyPanel(),
  };
}

export function mapRiskToCanonical(
  risk: string | undefined,
  attentionCount: number,
  hasFailures: boolean,
): FinalOutputContract["risk_level"] {
  if (risk === "high" || risk === "critical" || attentionCount >= 2) return "high";
  if (risk === "medium" || hasFailures || attentionCount >= 1) return "medium";
  return "low";
}

/** Normalize any risk input to canonical low | medium | high (critical → high). */
export function canonicalizeRiskLevel(risk: unknown): FinalOutputContract["risk_level"] {
  if (risk === "critical" || risk === "high") return "high";
  if (risk === "medium") return "medium";
  if (risk === "low") return "low";
  return "medium";
}

export function mapConfidenceToCanonical(
  level: string,
): FinalOutputContract["confidence_state"]["overall_confidence"] {
  if (level === "high") return "high";
  if (level === "medium" || level === "insufficient") return "medium";
  return "low";
}

export function computeCompleteness(understood: number, uncertain: number): number {
  const total = understood + uncertain;
  if (total === 0) return 0;
  return Math.round((understood / total) * 100);
}
