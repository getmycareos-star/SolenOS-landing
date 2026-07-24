import type { CaregiverLoad } from "../caregiver-load-index/types";
import type { EmotionalLoadSignalLayerResult } from "../emotional-load-signal/types";
import type { IdentityDriftLevel, IdentityDriftState } from "./types";

const IDENTITY_DRIFT_INPUT_PATTERNS: readonly { pattern: RegExp; signal: string }[] = [
  { pattern: /\bdon'?t (?:know|recognize) who i am\b/i, signal: "identity collapse language" },
  { pattern: /\blost (?:myself|who i am)\b/i, signal: "loss of self-identity" },
  { pattern: /\bnot (?:myself|the same person)\b/i, signal: "baseline identity shift" },
  { pattern: /\bonly a caregiver now\b/i, signal: "role-only identity" },
  { pattern: /\ball i am is\b/i, signal: "role collapse" },
  { pattern: /\bwho am i (?:anymore|now)\b/i, signal: "role confusion" },
  { pattern: /\bdon'?t know my role\b/i, signal: "role confusion" },
  { pattern: /\b(?:she|he|they) don'?t (?:know|recognize) me\b/i, signal: "loss of recognition from LO" },
  { pattern: /\bdoesn'?t (?:know|recognize) me anymore\b/i, signal: "loss of recognition from LO" },
  { pattern: /\bstranger (?:to me|in my house)\b/i, signal: "relational identity rupture" },
  { pattern: /\bi used to be\b/i, signal: "past-self contrast" },
  { pattern: /\bno life (?:outside|beyond) caregiving\b/i, signal: "life outside care eroded" },
  { pattern: /\bdisappeared as a person\b/i, signal: "identity fragmentation language" },
];

const SESSION_PRESSURE_SIGNALS = [
  "sustained CLI elevation",
  "chronic emotional load",
  "multi-session role strain",
] as const;

function classifyDrift(score: number): IdentityDriftLevel {
  if (score >= 0.78) return "FRAGMENTED";
  if (score >= 0.55) return "SIGNIFICANT";
  if (score >= 0.3) return "EMERGING";
  return "STABLE";
}

export type DetectIdentityDriftParams = {
  userInput?: string;
  caregiverLoad: CaregiverLoad;
  emotionalLoad?: EmotionalLoadSignalLayerResult;
  /** Memory / session hints — role confusion across sessions */
  sessionHints?: readonly string[];
  unresolvedSituationCount?: number;
  depletionState?: "normal" | "elevated" | "critical";
};

/**
 * Detect progressive loss of self-identity and role clarity under sustained pressure.
 */
export function detectIdentityDrift(params: DetectIdentityDriftParams): IdentityDriftState {
  const input = (params.userInput ?? "").trim();
  const signals: string[] = [];

  for (const { pattern, signal } of IDENTITY_DRIFT_INPUT_PATTERNS) {
    if (pattern.test(input) && !signals.includes(signal)) {
      signals.push(signal);
    }
  }

  for (const hint of params.sessionHints ?? []) {
    const h = hint.trim();
    if (h && !signals.includes(h)) signals.push(h);
  }

  const cliHigh =
    params.caregiverLoad.state === "HIGH" || params.caregiverLoad.state === "CRITICAL";
  const fatigue = params.emotionalLoad?.signal.cognitiveFatigue.level;
  const sustainedPressure =
    cliHigh &&
    (fatigue === "HIGH" || fatigue === "CRITICAL" || params.caregiverLoad.score >= 55);

  if (sustainedPressure) {
    signals.push(SESSION_PRESSURE_SIGNALS[0]);
  }
  if (fatigue === "HIGH" || fatigue === "CRITICAL") {
    signals.push(SESSION_PRESSURE_SIGNALS[1]);
  }
  if ((params.unresolvedSituationCount ?? 0) >= 2 && cliHigh) {
    signals.push(SESSION_PRESSURE_SIGNALS[2]);
  }
  if (params.depletionState === "critical" || params.depletionState === "elevated") {
    signals.push(`caregiver depletion ${params.depletionState}`);
  }

  const inputScore = Math.min(1, signals.filter((s) => !s.startsWith("sustained")).length * 0.16);
  const pressureScore =
    (params.caregiverLoad.score / 100) * 0.35 +
    (fatigue === "CRITICAL" ? 0.25 : fatigue === "HIGH" ? 0.15 : 0) +
    (params.depletionState === "critical" ? 0.15 : params.depletionState === "elevated" ? 0.08 : 0);

  const composite = Math.min(1, inputScore * 0.6 + pressureScore * 0.4);
  const driftLevel = classifyDrift(composite);

  let explanation = "Identity baseline appears stable under current pressure.";
  if (driftLevel !== "STABLE") {
    const primary = signals.slice(0, 3).join(", ");
    explanation =
      driftLevel === "FRAGMENTED" || driftLevel === "SIGNIFICANT"
        ? `Identity drift ${driftLevel.toLowerCase()}: role clarity and emotional baseline are eroding (${primary}).`
        : `Emerging identity drift (${primary}) — role and self-recognition under pressure.`;
  }

  return { driftLevel, signals, explanation };
}
