import { canonicalizeRiskLevel } from "../final-output-contract";
import type { SolenOSOutput } from "../output-contract/types";
import { validateAIResponse } from "../response-validator";
import type {
  Classification,
  DecisionState,
  DomainTag,
  SignalVector,
} from "./types";
import { mapInternalRiskToOutput } from "./decision-engine";

export interface ResponseMappingInput {
  raw: string;
  classification: Classification;
  domain: DomainTag;
  signals: SignalVector;
  decision: DecisionState;
  safe_mode: boolean;
}

function buildSummary(raw: string, signals: SignalVector): string {
  const cleaned = raw.replace(/\s{2,}/g, " ").trim();
  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.length > 8 && !s.includes("?"))
    .slice(0, 2);

  let summary = sentences.length > 0 ? sentences.join(" ") : cleaned.slice(0, 280);
  if (signals.emotional_intensity >= 0.5) {
    summary = `It makes sense to feel stressed in situations like this. ${summary}`;
  }
  if (signals.uncertainty_markers.length > 0) {
    summary += " Some details remain unclear.";
  }
  return summary.slice(0, 400) || "A caregiving situation was described.";
}

export function mapResponse(input: ResponseMappingInput): SolenOSOutput {
  const uncertain =
    input.signals.uncertainty_markers.length > 0 ||
    input.classification === "ambiguous" ||
    input.decision.blocking_factor === "missing_baseline";

  const medRisk = input.signals.urgency_signals.length
    ? Math.max(...input.signals.urgency_signals)
    : 0;

  const risk_level = mapInternalRiskToOutput(
    input.decision.risk_level,
    uncertain,
    medRisk,
  );

  const what_can_wait =
    risk_level === "high"
      ? "Insurance, scheduling, and family discussions wait until immediate safety is addressed."
      : uncertain
        ? "Most actions wait until the missing fact above is clarified."
        : "Long-term planning and non-urgent tasks wait until today's priority is complete.";

  return validateAIResponse({
    what_is_happening: buildSummary(input.raw, input.signals),
    what_matters_now: input.decision.primary_action,
    what_to_ask_next:
      input.decision.next_question || "What is the one missing fact right now?",
    risk_level: canonicalizeRiskLevel(risk_level),
    what_can_wait,
    follow_up_items: input.signals.context_entities.slice(0, 5),
    decision_trace: {
      events: input.signals.medical_entities.slice(0, 5),
      assumptions: input.signals.inferred.slice(0, 3).map((inf) => inf.signal),
      unknowns: input.signals.uncertainty_markers.slice(0, 5),
      evidence_sources: input.signals.medical_entities.slice(0, 3),
    },
    confidence_state: {
      overall_confidence: uncertain ? "low" : "medium",
      completeness: Math.round(input.signals.emotional_intensity * 100),
      reasoning_limits: input.signals.uncertainty_markers.slice(0, 3),
    },
    trust_layer: {
      known: input.signals.medical_entities.slice(0, 3).map((entity) => ({
        statement: entity,
        source: "caregiver_input",
        source_type: "caregiver_input" as const,
      })),
      assumed: input.signals.context_entities.slice(0, 2).map((entity) => ({
        statement: entity,
        reasoning_basis: "contextual inference",
        source_engine: "signal_extraction",
      })),
      unknown: input.signals.uncertainty_markers.slice(0, 3).map((m) => ({
        statement: m,
        drives_clarification: true,
      })),
      recency: {
        last_updated_at: new Date().toISOString(),
        freshness_score: 0.5,
        interpretation: "recently recorded",
      },
      confidence: uncertain ? 0.2 : 0.5,
    },
    transparency_panel: {
      data_used: {
        care_events: input.signals.medical_entities.slice(0, 3),
        timeline_segments: [],
        caregiver_inputs: [input.raw.slice(0, 200)],
      },
      data_ignored: {
        conflicting: [],
        low_confidence: input.signals.uncertainty_markers.slice(0, 2),
        stale_or_decayed: [],
      },
      reason_for_output: "Structured cognitive decomposition of caregiver input.",
      evidence_breakdown: input.signals.medical_entities.slice(0, 3).map((entity) => ({
        conclusion: entity,
        evidence_type: "observation" as const,
        confidence_pct: 50,
      })),
      confidence_scores: {
        overall_pct: uncertain ? 20 : 50,
        tier: uncertain ? "low" : "medium",
      },
      recency: {
        last_update_at: new Date().toISOString(),
        critical_event_ages: [],
        decay_status: "fresh",
      },
      observed: input.signals.medical_entities.slice(0, 3),
      inferred: input.signals.inferred.slice(0, 2).map((inf) => inf.signal),
    },
  });
}
