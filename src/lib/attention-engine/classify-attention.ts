import type { DetectedLoadSignalFamilies, LoadScores } from "../caregiver-load-engine/types";
import type { InteractionLoadSignalResult } from "../interaction-load-signal/types";
import type { UrgencyDetectionResult } from "../urgency-detection";
import {
  ATTENTION_CLASS_A_PATTERNS,
  ATTENTION_CLASS_B_PATTERNS,
  ATTENTION_CLASS_C_PATTERNS,
  ATTENTION_CLASS_HIT,
} from "./contract-constants";
import {
  attentionClassToPriority,
  labelForAttentionClass,
} from "./attention-labels";
import type { AttentionClassification } from "./types";

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, Math.round(n * 1000) / 1000));
}

function scorePatternGroups(
  input: string,
  groups: Record<string, readonly RegExp[]>,
  baseWeight: number,
): number {
  let maxScore = 0;
  for (const patterns of Object.values(groups)) {
    let hits = 0;
    for (const pattern of patterns) {
      if (pattern.test(input)) hits += 1;
    }
    if (hits > 0) {
      maxScore = Math.max(maxScore, clamp01(Math.min(1, baseWeight + (hits - 1) * 0.12)));
    }
  }
  return maxScore;
}

function dominantLoadCategory(
  signals: DetectedLoadSignalFamilies,
  scores: LoadScores,
): AttentionClassification["dominantLoadCategory"] {
  const ranked = [
    { key: "repetition" as const, score: signals.repetition * 100 + scores.cognitiveLoadScore * 0.4 },
    { key: "sleep" as const, score: signals.sleep * 100 + scores.sleepRiskScore * 0.4 },
    { key: "emotional" as const, score: signals.emotionalDistress * 100 + scores.emotionalLoadScore * 0.4 },
    { key: "uncertainty" as const, score: signals.uncertainty * 100 + scores.uncertaintyIndex * 40 },
    { key: "dependency" as const, score: (signals.supervision + signals.assistance) * 50 + scores.dependencyLoadScore * 0.4 },
  ];
  ranked.sort((a, b) => b.score - a.score);
  return ranked[0]!.score >= 35 ? ranked[0]!.key : null;
}

export type ClassifyAttentionParams = {
  rawInput: string;
  urgencyDetection: UrgencyDetectionResult;
  scores: LoadScores;
  signals: DetectedLoadSignalFamilies;
  interactionLoadLayer?: InteractionLoadSignalResult;
  acuteBurnoutTriggered?: boolean;
  safetyOverrideEngaged?: boolean;
};

function buildReasoning(
  attentionClass: AttentionClassification["attentionClass"],
  params: ClassifyAttentionParams,
  dominant: AttentionClassification["dominantLoadCategory"],
): string {
  if (attentionClass === "A") {
    if (params.urgencyDetection.risk_level === "critical") {
      return "Safety signals or acute change detected — this needs immediate attention.";
    }
    return "A safety-related or sudden-change signal is present — prioritize attention now.";
  }
  if (attentionClass === "B") {
    if (dominant === "repetition") {
      return "Repetition or gradual change is building strain — worth watching, not necessarily urgent.";
    }
    if (dominant === "sleep") {
      return "Sleep disruption is accumulating — monitor closely before it escalates.";
    }
    return "Load is rising without an acute safety signal — pay attention, but urgency is moderate.";
  }
  return "No acute safety signal and load is manageable — this can wait.";
}

/**
 * Classify incoming situation into Class A (Now) / B (Watch) / C (Later).
 */
export function classifyAttention(params: ClassifyAttentionParams): AttentionClassification {
  const text = params.rawInput.trim();

  let classAScore = scorePatternGroups(text, ATTENTION_CLASS_A_PATTERNS, 0.55);
  if (params.urgencyDetection.risk_level === "critical") {
    classAScore = Math.max(classAScore, 0.95);
  } else if (params.urgencyDetection.risk_level === "high") {
    classAScore = Math.max(classAScore, 0.75);
  }
  if (params.safetyOverrideEngaged) {
    classAScore = Math.max(classAScore, 0.85);
  }
  if (params.acuteBurnoutTriggered) {
    classAScore = Math.max(classAScore, 0.7);
  }

  let classBScore = scorePatternGroups(text, ATTENTION_CLASS_B_PATTERNS, 0.48);
  classBScore = Math.max(
    classBScore,
    params.signals.repetition >= 0.35 ? params.signals.repetition : 0,
    params.scores.cognitiveLoadScore >= 50 ? 0.55 : 0,
    params.interactionLoadLayer?.detected ? 0.5 : 0,
    params.scores.emotionalLoadScore >= 55 ? 0.45 : 0,
  );

  let classCScore = scorePatternGroups(text, ATTENTION_CLASS_C_PATTERNS, 0.42);
  if (params.urgencyDetection.risk_level === "low" || params.urgencyDetection.risk_level === "medium") {
    classCScore = Math.max(classCScore, 0.35);
  }
  if (
    classAScore < ATTENTION_CLASS_HIT &&
    classBScore < ATTENTION_CLASS_HIT &&
    params.scores.emotionalLoadScore < 40 &&
    params.scores.cognitiveLoadScore < 40
  ) {
    classCScore = Math.max(classCScore, 0.5);
  }

  let attentionClass: AttentionClassification["attentionClass"];
  if (classAScore >= ATTENTION_CLASS_HIT && classAScore >= classBScore) {
    attentionClass = "A";
  } else if (classBScore >= ATTENTION_CLASS_HIT && classBScore >= classCScore) {
    attentionClass = "B";
  } else {
    attentionClass = "C";
  }

  const dominant = dominantLoadCategory(params.signals, params.scores);
  const attentionPriority = attentionClassToPriority(attentionClass);
  const label = labelForAttentionClass(attentionClass);
  const winnerScore =
    attentionClass === "A" ? classAScore : attentionClass === "B" ? classBScore : classCScore;

  return {
    attentionClass,
    attentionPriority,
    label,
    reasoning: buildReasoning(attentionClass, params, dominant),
    confidence: clamp01(winnerScore),
    classAScore,
    classBScore,
    classCScore,
    dominantLoadCategory: dominant,
  };
}
