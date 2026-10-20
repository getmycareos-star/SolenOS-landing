import type {
  ContextHealth,
  ContradictionHealth,
  DecisionHealth,
  DimensionScores,
  DocumentHealth,
  MemoryHealth,
  SituationHealth,
  SystemHealth,
} from "./types";
import { SYSTEM_HEALTH_WEIGHTS } from "./contract-constants";
import type { HealthBand } from "./types";
import {
  REJECTION_DRIFT_MIN_SAMPLES,
  REJECTION_DRIFT_RATIO_THRESHOLD,
  SITUATION_LOAD_HIGH_THRESHOLD,
  UNREAD_CRITICAL_DOCUMENT_PENALTY,
} from "./contract-constants";

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function penalize(base: number, count: number, perUnit: number, cap = 80): number {
  return clampScore(base - Math.min(cap, count * perUnit));
}

export function scoreContextQuality(ctx: ContextHealth): number {
  let score = 100;
  score = penalize(score, ctx.missingCriticalInformation, 14, 56);
  score = penalize(score, ctx.unresolvedQuestions, 10, 50);
  score = penalize(score, ctx.staleContextItems, 8, 40);
  return score;
}

export function scoreMemoryQuality(mem: MemoryHealth): number {
  let score = 100;
  score = penalize(score, mem.outdatedMemoryCount, 12, 48);
  score = penizeCorrected(score, mem.correctedMemoryCount);
  score = penalize(score, mem.conflictingMemoryCount, 16, 64);
  return score;
}

function penizeCorrected(score: number, corrected: number): number {
  // Corrected (incorrect-tagged) memory is informative but still reduces trust until reconciled.
  return penalize(score, corrected, 10, 40);
}

export function scoreSituationCoverage(sit: SituationHealth): number {
  let score = 100;
  score = penalize(score, sit.blockedSituations, 14, 56);
  score = penalize(score, sit.unresolvedSituations, 12, 48);
  if (sit.activeSituations >= SITUATION_LOAD_HIGH_THRESHOLD) {
    score = clampScore(score - 10 - (sit.activeSituations - SITUATION_LOAD_HIGH_THRESHOLD) * 4);
  }
  return score;
}

/** Contradictions MUST reduce health — heavy penalty. */
export function scoreContradictionHealth(c: ContradictionHealth): number {
  let score = 100;
  score = penalize(score, c.contradictionsDetected, 18, 72);
  score = penalize(score, c.unresolvedContradictions, 22, 88);
  if (c.contradictionsDetected > 0 || c.unresolvedContradictions > 0) {
    score = Math.min(score, 85);
  }
  return score;
}

export function scoreDocumentHealth(doc: DocumentHealth): number {
  let score = 100;
  // Unread critical documents heavily impact health.
  score = clampScore(score - doc.unreadCriticalDocuments * UNREAD_CRITICAL_DOCUMENT_PENALTY);
  const nonCriticalUnread = Math.max(0, doc.unreadDocuments - doc.unreadCriticalDocuments);
  score = penalize(score, nonCriticalUnread, 8, 40);
  score = penalize(score, doc.staleDocuments, 10, 40);
  score = penalize(score, doc.lowConfidenceExtractions, 12, 48);
  return score;
}

export function scoreDecisionHealth(dec: DecisionHealth): number {
  const total =
    dec.acceptedRecommendations +
    dec.rejectedRecommendations +
    dec.overriddenRecommendations;
  if (total === 0) return 100;

  const acceptRate = dec.acceptedRecommendations / total;
  let score = clampScore(40 + acceptRate * 60);

  const rejectRatio =
    (dec.rejectedRecommendations + dec.overriddenRecommendations * 0.5) / total;
  if (total >= REJECTION_DRIFT_MIN_SAMPLES && rejectRatio >= REJECTION_DRIFT_RATIO_THRESHOLD) {
    score = clampScore(score - 25);
  }
  score = penalize(score, dec.rejectedRecommendations, 6, 36);
  score = penalize(score, dec.overriddenRecommendations, 4, 24);
  return score;
}

export function computeDimensionScores(health: Omit<SystemHealth, "overallHealthScore">): DimensionScores {
  return {
    contextQuality: scoreContextQuality(health.contextQuality),
    memoryQuality: scoreMemoryQuality(health.memoryQuality),
    situationCoverage: scoreSituationCoverage(health.situationCoverage),
    contradictionHealth: scoreContradictionHealth(health.contradictionHealth),
    documentHealth: scoreDocumentHealth(health.documentHealth),
    decisionHealth: scoreDecisionHealth(health.decisionHealth),
  };
}

/**
 * Weighted overall readiness score.
 * overall = Σ (dimensionScore × weight)
 */
export function computeOverallHealthScore(dimensions: DimensionScores): number {
  const w = SYSTEM_HEALTH_WEIGHTS;
  const raw =
    dimensions.contextQuality * w.contextQuality +
    dimensions.memoryQuality * w.memoryQuality +
    dimensions.situationCoverage * w.situationCoverage +
    dimensions.contradictionHealth * w.contradictionHealth +
    dimensions.documentHealth * w.documentHealth +
    dimensions.decisionHealth * w.decisionHealth;
  return clampScore(raw);
}

export function labelHealthBand(overallHealthScore: number): HealthBand {
  const score = clampScore(overallHealthScore);
  if (score >= 90) return "Strong";
  if (score >= 75) return "Stable";
  if (score >= 50) return "Degraded";
  return "Unreliable";
}

export function buildSystemHealth(
  parts: Omit<SystemHealth, "overallHealthScore">,
): { health: SystemHealth; dimensionScores: DimensionScores; band: HealthBand } {
  const dimensionScores = computeDimensionScores(parts);
  const overallHealthScore = computeOverallHealthScore(dimensionScores);
  return {
    health: { ...parts, overallHealthScore },
    dimensionScores,
    band: labelHealthBand(overallHealthScore),
  };
}
