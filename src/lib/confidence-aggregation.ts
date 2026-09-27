import type { EvidenceObject, EvidencedConclusion } from "./evidence-preservation";
import type { ContradictionDetectionResult } from "./contradiction-detection-engine";
import type { BaselineIntelligenceResult } from "./baseline-intelligence-engine";

export interface OpenContradiction {
  id: string;
  description: string;
  severity: "low" | "medium" | "high";
  conflictingModules: string[];
  detectedAt: string;
}

export interface ConfidenceAggregationInput {
  module_scores: Record<string, number>;
  evidence_objects: EvidenceObject[];
  contradictions: OpenContradiction[];
  baseline?: BaselineIntelligenceResult;
  as_of: string;
}

export interface AreaConfidence {
  area: string;
  score: number;
  label: string;
  evidence_count: number;
  has_contradictions: boolean;
  what_would_improve: string[];
}

export interface AggregatedConfidence {
  overall: number;
  by_area: Record<string, AreaConfidence>;
  label: string;
  evidence_count: number;
  contradiction_penalty: number;
  computed_at: string;
  should_surface: boolean;
}

const CONTRADICTION_PENALTY_PER = 0.1;
const MAX_CONTRADICTION_PENALTY = 0.3;
const EVIDENCE_BONUS_PER = 0.02;
const MAX_EVIDENCE_BONUS = 0.1;
const BAYESIAN_CLAMP_MIN = 0.05;
const BAYESIAN_CLAMP_MAX = 0.95;

export function bayesianUpdate(prior: number, evidence: number, reliability: number): number {
  const clampedPrior = Math.max(BAYESIAN_CLAMP_MIN, Math.min(BAYESIAN_CLAMP_MAX, prior));
  const clampedEvidence = Math.max(BAYESIAN_CLAMP_MIN, Math.min(BAYESIAN_CLAMP_MAX, evidence));
  const clampedReliability = Math.max(BAYESIAN_CLAMP_MIN, Math.min(BAYESIAN_CLAMP_MAX, reliability));

  const numerator = clampedPrior * clampedEvidence * clampedReliability;
  const denominator =
    numerator +
    (1 - clampedPrior) * (1 - clampedEvidence) * (1 - clampedReliability);

  if (denominator === 0) {
    return clampedPrior;
  }

  const posterior = numerator / denominator;
  return Math.max(BAYESIAN_CLAMP_MIN, Math.min(BAYESIAN_CLAMP_MAX, posterior));
}

function confidenceToLabel(score: number): "high" | "moderate" | "limited" | "low" {
  if (score >= 0.7) return "high";
  if (score >= 0.5) return "moderate";
  if (score >= 0.3) return "limited";
  return "low";
}

function computeContradictionPenalty(contradictions: OpenContradiction[]): number {
  const penalty = contradictions.length * CONTRADICTION_PENALTY_PER;
  return Math.min(penalty, MAX_CONTRADICTION_PENALTY);
}

function computeEvidenceBonus(evidenceObjects: EvidenceObject[]): number {
  const bonus = evidenceObjects.length * EVIDENCE_BONUS_PER;
  return Math.min(bonus, MAX_EVIDENCE_BONUS);
}

function getAreaFromModule(moduleName: string): string {
  const areaMap: Record<string, string> = {
    nutrition: "nutrition",
    hydration: "hydration",
    medication: "medication",
    mobility: "mobility",
    cognition: "cognition",
    mood: "mood",
    sleep: "sleep",
    skin: "skin_integrity",
    elimination: "elimination",
    pain: "pain_management",
    social: "social_engagement",
    safety: "safety",
  };

  for (const [key, area] of Object.entries(areaMap)) {
    if (moduleName.toLowerCase().includes(key)) {
      return area;
    }
  }
  return "general";
}

export function computeAreaConfidence(
  area: string,
  evidenceObjects: EvidenceObject[],
  contradictions: OpenContradiction[]
): AreaConfidence {
  const areaEvidence = evidenceObjects.filter((e) => {
    const moduleArea = getAreaFromModule(e.module || "");
    return moduleArea === area;
  });

  const areaContradictions = contradictions.filter((c) =>
    c.conflictingModules.some((m) => getAreaFromModule(m) === area)
  );

  const evidenceCount = areaEvidence.length;
  const hasContradictions = areaContradictions.length > 0;

  let baseScore = 0.5;

  if (evidenceCount > 0) {
    const avgEvidenceStrength =
      areaEvidence.reduce((sum, e) => sum + (e.confidence || 0.5), 0) / evidenceCount;
    baseScore = bayesianUpdate(baseScore, avgEvidenceStrength, 0.8);
  }

  const evidenceBonus = computeEvidenceBonus(areaEvidence);
  const contradictionPenalty = computeContradictionPenalty(areaContradictions);

  let finalScore = baseScore + evidenceBonus - contradictionPenalty;
  finalScore = Math.max(BAYESIAN_CLAMP_MIN, Math.min(BAYESIAN_CLAMP_MAX, finalScore));

  const label = confidenceToLabel(finalScore);

  const whatWouldImprove: string[] = [];
  if (evidenceCount < 3) {
    whatWouldImprove.push(`Add more ${area} observations (currently ${evidenceCount})`);
  }
  if (hasContradictions) {
    whatWouldImprove.push(`Resolve ${areaContradictions.length} contradiction(s) in ${area}`);
  }
  if (finalScore < 0.7) {
    whatWouldImprove.push(`Increase ${area} evidence quality and consistency`);
  }

  return {
    area,
    score: finalScore,
    label,
    evidence_count: evidenceCount,
    has_contradictions: hasContradictions,
    what_would_improve: whatWouldImprove,
  };
}

export function shouldShowConfidenceToCaregiver(aggregated: AggregatedConfidence): boolean {
  if (aggregated.evidence_count < 2) return false;
  if (aggregated.contradiction_penalty >= MAX_CONTRADICTION_PENALTY) return false;
  if (aggregated.overall < 0.3) return false;
  return true;
}

export function aggregateConfidence(input: ConfidenceAggregationInput): AggregatedConfidence {
  const { module_scores, evidence_objects, contradictions, baseline, as_of } = input;

  const allAreas = new Set<string>();
  for (const moduleName of Object.keys(module_scores)) {
    allAreas.add(getAreaFromModule(moduleName));
  }
  for (const evidence of evidence_objects) {
    allAreas.add(getAreaFromModule(evidence.module || ""));
  }
  for (const contradiction of contradictions) {
    for (const module of contradiction.conflictingModules) {
      allAreas.add(getAreaFromModule(module));
    }
  }

  const byArea: Record<string, AreaConfidence> = {};
  let totalScore = 0;
  let areaCount = 0;

  for (const area of allAreas) {
    const areaConfidence = computeAreaConfidence(area, evidence_objects, contradictions);
    byArea[area] = areaConfidence;
    totalScore += areaConfidence.score;
    areaCount++;
  }

  const contradictionPenalty = computeContradictionPenalty(contradictions);
  const evidenceBonus = computeEvidenceBonus(evidence_objects);

  let overallScore = areaCount > 0 ? totalScore / areaCount : 0.5;
  overallScore = overallScore + evidenceBonus - contradictionPenalty;
  overallScore = Math.max(BAYESIAN_CLAMP_MIN, Math.min(BAYESIAN_CLAMP_MAX, overallScore));

  if (baseline && baseline.confidence !== undefined) {
    overallScore = bayesianUpdate(overallScore, baseline.confidence, baseline.reliability || 0.7);
  }

  const label = confidenceToLabel(overallScore);
  const shouldSurface = shouldShowConfidenceToCaregiver({
    overall: overallScore,
    by_area: byArea,
    label,
    evidence_count: evidence_objects.length,
    contradiction_penalty: contradictionPenalty,
    computed_at: as_of,
    should_surface: false,
  });

  return {
    overall: overallScore,
    by_area: byArea,
    label,
    evidence_count: evidence_objects.length,
    contradiction_penalty: contradictionPenalty,
    computed_at: as_of,
    should_surface: shouldSurface,
  };
}