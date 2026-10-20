import { detectGuiltReplayPatterns } from "../cognitive-compression";
import type { CaregiverLoad } from "../caregiver-load-index/types";
import type { EmotionalLoadSignalLayerResult } from "../emotional-load-signal/types";
import type { MoralInjurySeverity, MoralInjurySignal } from "./types";

const MORAL_INJURY_INPUT_PATTERNS: readonly { pattern: RegExp; indicator: string }[] = [
  { pattern: /\bi should (?:be able to|have been able to)\b/i, indicator: "should handle this alone" },
  { pattern: /\bi should endure\b/i, indicator: "endurance obligation" },
  { pattern: /\bi should just (?:push through|deal with|handle)\b/i, indicator: "self-expectation to endure" },
  { pattern: /\bi'?m failing (?:as|at being)\b/i, indicator: "failure perception" },
  { pattern: /\bi failed (?:as|to be)\b/i, indicator: "failure perception" },
  { pattern: /\bit'?s my fault\b/i, indicator: "self-blame" },
  { pattern: /\bi blame myself\b/i, indicator: "self-blame" },
  { pattern: /\bnot doing enough\b/i, indicator: "inadequacy guilt" },
  { pattern: /\bi should do more\b/i, indicator: "guilt-driven overextension" },
  { pattern: /\bcan'?t take it anymore\b/i, indicator: "moral exhaustion" },
  { pattern: /\bexhausted from trying\b/i, indicator: "moral exhaustion" },
  { pattern: /\bno matter what i do\b/i, indicator: "helplessness loop" },
  { pattern: /\bi'?m helpless\b/i, indicator: "helplessness language" },
  { pattern: /\bnothing i do (?:is|feels) enough\b/i, indicator: "moral inadequacy loop" },
  { pattern: /\bi owe (?:them|him|her)\b/i, indicator: "moral debt framing" },
  { pattern: /\bgood (?:daughter|son|caregiver|wife|husband) would\b/i, indicator: "role-moral guilt" },
];

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function classifySeverity(score: number): MoralInjurySeverity {
  if (score >= 0.82) return "CRITICAL";
  if (score >= 0.62) return "HIGH";
  if (score >= 0.38) return "MEDIUM";
  return "LOW";
}

export type DetectMoralInjuryParams = {
  userInput?: string;
  caregiverLoad: CaregiverLoad;
  emotionalLoad?: EmotionalLoadSignalLayerResult;
  guiltReplayDetected?: boolean;
  openConflictCount?: number;
  emotionalContradictionLoopCount?: number;
};

/**
 * Derive moral injury from input signals, CLI, emotional load, and conflict loops.
 */
export function detectMoralInjury(params: DetectMoralInjuryParams): MoralInjurySignal {
  const input = (params.userInput ?? "").trim();
  const indicators: string[] = [];

  for (const { pattern, indicator } of MORAL_INJURY_INPUT_PATTERNS) {
    if (pattern.test(input) && !indicators.includes(indicator)) {
      indicators.push(indicator);
    }
  }

  if (params.guiltReplayDetected ?? detectGuiltReplayPatterns(input)) {
    if (!indicators.includes("guilt replay loop")) {
      indicators.push("guilt replay loop");
    }
  }

  const cliNorm = clamp01(params.caregiverLoad.score / 100);
  if (params.caregiverLoad.state === "CRITICAL" || params.caregiverLoad.state === "HIGH") {
    indicators.push(`CLI ${params.caregiverLoad.state.toLowerCase()} (${params.caregiverLoad.score.toFixed(0)})`);
  }

  const fatigue = params.emotionalLoad?.signal.cognitiveFatigue.level;
  if (fatigue === "HIGH" || fatigue === "CRITICAL") {
    indicators.push(`cognitive fatigue ${fatigue.toLowerCase()}`);
  }

  const burnout = params.emotionalLoad?.signal.burnoutProbability.value ?? 0;
  if (burnout >= 0.55) {
    indicators.push(`burnout probability ${(burnout * 100).toFixed(0)}%`);
  }

  if ((params.openConflictCount ?? 0) >= 2) {
    indicators.push("unresolved conflict pressure");
  }

  if ((params.emotionalContradictionLoopCount ?? 0) > 0) {
    indicators.push("emotional contradiction loop");
  }

  const guiltIndicators = indicators.filter(
    (i) =>
      !i.startsWith("CLI") &&
      !i.startsWith("cognitive fatigue") &&
      !i.startsWith("burnout") &&
      !i.startsWith("unresolved") &&
      !i.startsWith("emotional contradiction"),
  );
  const inputScore = Math.min(1, guiltIndicators.length * 0.18 + (guiltIndicators.length >= 3 ? 0.15 : 0));
  const loadScore =
    cliNorm * 0.28 +
    (params.caregiverLoad.conflictLoad / 100) * 0.12 +
    (params.caregiverLoad.uncertaintyLoad / 100) * 0.08 +
    burnout * 0.22 +
    (fatigue === "CRITICAL" ? 0.2 : fatigue === "HIGH" ? 0.12 : fatigue === "MEDIUM" ? 0.06 : 0);

  const composite = clamp01(inputScore * 0.55 + loadScore * 0.45);
  const severity = classifySeverity(composite);
  const contributionToLoad = clamp01(
    composite * 0.7 + (severity === "CRITICAL" ? 0.15 : severity === "HIGH" ? 0.08 : 0),
  );

  let explanation = "No significant moral injury signals detected.";
  if (severity !== "LOW") {
    const primary = indicators.slice(0, 3).join(", ");
    explanation =
      severity === "CRITICAL" || severity === "HIGH"
        ? `Moral injury ${severity.toLowerCase()}: guilt, self-blame, or endurance pressure is actively increasing emotional load (${primary}).`
        : `Emerging moral injury signals (${primary}) — monitor before load compounds.`;
  }

  return {
    severity,
    indicators,
    contributionToLoad,
    explanation,
  };
}
