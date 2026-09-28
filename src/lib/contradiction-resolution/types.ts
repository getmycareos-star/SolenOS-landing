/**
 * Contradiction resolution engine — source reliability, corroboration, hypotheses.
 *
 * The existing contradiction-detection-engine detects contradictions. This
 * layer adds the missing piece: reasoning about which reading is more likely
 * correct, and generating hypotheses about why the contradiction exists.
 */

export const CONTRADICTION_RESOLUTION_VERSION = "1.0.0";

export type SourceReliability = {
  sourceType: "caregiver" | "document" | "clinician" | "family" | "other";
  reliability: number;
  reasoning: string;
};

export type ContradictionResolution = {
  id: string;
  claimA: string;
  claimB: string;
  field: string;
  /** Which reading is more likely correct, and why. */
  likelyCorrect: "a" | "b" | "neither" | "both_possible";
  confidence: number;
  reasoning: string;
  /** Hypotheses about why the contradiction exists. */
  hypotheses: string[];
  /** What would resolve it. */
  resolutionPath: string;
  /** Source reliability assessment. */
  sourceAssessment: {
    a: SourceReliability;
    b: SourceReliability;
  };
  /** Temporal ordering — which is more recent? */
  temporalOrder: "a_more_recent" | "b_more_recent" | "unknown" | "same_time";
  /** Corroboration — does one reading have more supporting evidence? */
  corroboration: "a_supported" | "b_supported" | "both_supported" | "neither_supported";
  /** Whether this needs human confirmation. */
  needsHumanConfirmation: boolean;
  recordedAt: string;
};

export type ContradictionResolutionResult = {
  version: string;
  resolutions: ContradictionResolution[];
  unresolvedCount: number;
  needsHumanCount: number;
  source: "llm" | "rules" | "llm+rules";
  degraded: boolean;
  model: string | null;
  durationMs: number;
};

export function createEmptyResolutionResult(): ContradictionResolutionResult {
  return {
    version: CONTRADICTION_RESOLUTION_VERSION,
    resolutions: [],
    unresolvedCount: 0,
    needsHumanCount: 0,
    source: "rules",
    degraded: true,
    model: null,
    durationMs: 0,
  };
}

export function summarizeResolutions(
  result: ContradictionResolutionResult,
): {
  resolutionCount: number;
  unresolvedCount: number;
  needsHumanCount: number;
  likelyACount: number;
  likelyBCount: number;
  neitherCount: number;
} {
  let likelyA = 0;
  let likelyB = 0;
  let neither = 0;
  for (const r of result.resolutions) {
    if (r.likelyCorrect === "a") likelyA++;
    else if (r.likelyCorrect === "b") likelyB++;
    else neither++;
  }
  return {
    resolutionCount: result.resolutions.length,
    unresolvedCount: result.unresolvedCount,
    needsHumanCount: result.needsHumanCount,
    likelyACount: likelyA,
    likelyBCount: likelyB,
    neitherCount: neither,
  };
}