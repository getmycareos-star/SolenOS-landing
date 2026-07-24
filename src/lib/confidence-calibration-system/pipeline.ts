import {
  COMPLETENESS_PENALTY_PER_MISSING,
  CONFIDENCE_CALIBRATION_DEFINING_PRINCIPLE,
  CONFIDENCE_CALIBRATION_RULES,
  CONFIDENCE_CEILING,
  CONFIDENCE_FLOOR,
  CONFIRMATION_BOOST,
  CONTRADICTION_PENALTY,
  HIGH_RISK_DECAY_HALF_LIFE_DAYS,
  INFERENCE_CEILING,
  SOURCE_TYPE_WEIGHTS,
  STABLE_DECAY_HALF_LIFE_DAYS,
} from "./contract-constants";
import type {
  CalibratedConfidence,
  CareEventConfidenceInput,
  ConfidenceCalibrationResult,
  ProcessConfidenceCalibrationInput,
} from "./types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function recencyDecay(ageMs: number, highRisk: boolean): number {
  const halfLife = highRisk ? HIGH_RISK_DECAY_HALF_LIFE_DAYS : STABLE_DECAY_HALF_LIFE_DAYS;
  const ageDays = Math.max(0, ageMs / MS_PER_DAY);
  // Exponential decay: 0.5^(age/halfLife)
  return Math.pow(0.5, ageDays / halfLife);
}

function clampScore(score: number, isObservation: boolean): number {
  const ceiling = isObservation ? CONFIDENCE_CEILING : Math.min(CONFIDENCE_CEILING, INFERENCE_CEILING);
  return Math.min(ceiling, Math.max(CONFIDENCE_FLOOR, score));
}

/**
 * Deterministic confidence scoring — same inputs always produce same score.
 * Observations dominate; silence accumulates uncertainty via decay.
 */
export function computeEventConfidence(input: CareEventConfidenceInput): CalibratedConfidence {
  const source_base = SOURCE_TYPE_WEIGHTS[input.source_type];
  const observation_weight = input.is_observation ? 1.0 : 0.45;
  const inference_weight = input.is_observation ? 0.2 : 0.75;

  // Weighted blend: observations always dominate the blend weight
  let score =
    source_base * (0.55 * observation_weight + 0.25 * (1 - inference_weight * 0.5) + 0.2);

  const recency_factor = recencyDecay(input.age_ms, input.high_risk_context);
  score *= recency_factor;

  const contradiction_factor = input.contradicted ? 1 - CONTRADICTION_PENALTY : 1;
  score *= contradiction_factor;

  const confirmation_boost = Math.min(0.24, input.confirmation_count * CONFIRMATION_BOOST);
  const confirmation_factor = 1 + confirmation_boost;
  score *= confirmation_factor;

  const completeness_penalty = Math.min(
    0.35,
    input.missing_critical_fields * COMPLETENESS_PENALTY_PER_MISSING,
  );
  const completeness_factor = 1 - completeness_penalty;
  score *= completeness_factor;

  // Observations dominate: inferred scores cannot exceed observed-equivalent path
  if (!input.is_observation) {
    score = Math.min(score, source_base * INFERENCE_CEILING);
  }

  const finalScore = clampScore(score, input.is_observation);

  const reasons: string[] = [
    `source=${input.source_type}(${source_base.toFixed(2)})`,
    `recency=${recency_factor.toFixed(2)}`,
  ];
  if (input.contradicted) reasons.push("contradiction_penalty");
  if (input.confirmation_count > 0) reasons.push(`confirmations=${input.confirmation_count}`);
  if (input.missing_critical_fields > 0) {
    reasons.push(`missing_fields=${input.missing_critical_fields}`);
  }
  if (!input.is_observation) reasons.push("inference_capped");

  return {
    score: Number(finalScore.toFixed(3)),
    factors: {
      observation_weight,
      inference_weight,
      recency_factor: Number(recency_factor.toFixed(3)),
      contradiction_factor: Number(contradiction_factor.toFixed(3)),
      confirmation_factor: Number(confirmation_factor.toFixed(3)),
      completeness_factor: Number(completeness_factor.toFixed(3)),
      source_base,
    },
    reason: reasons.join("; "),
    is_observation: input.is_observation,
    source_type: input.source_type,
  };
}

export function processConfidenceCalibration(
  input: ProcessConfidenceCalibrationInput,
): ConfidenceCalibrationResult {
  const event_confidences = input.events.map((event) => ({
    event_id: event.event_id,
    confidence: computeEventConfidence(event),
  }));

  const aggregate =
    event_confidences.length === 0
      ? CONFIDENCE_FLOOR
      : event_confidences.reduce((sum, e) => sum + e.confidence.score, 0) /
        event_confidences.length;

  return {
    active: true,
    event_confidences,
    aggregate_confidence: Number(aggregate.toFixed(3)),
    aggregate_reason:
      event_confidences.length === 0
        ? "No events — confidence at uncertainty floor"
        : `Mean calibrated confidence across ${event_confidences.length} event(s)`,
    rules_upheld: [...CONFIDENCE_CALIBRATION_RULES],
    defining_principle: CONFIDENCE_CALIBRATION_DEFINING_PRINCIPLE,
  };
}
