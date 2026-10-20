import { randomUUID } from "node:crypto";
import type { CaregiverLoad } from "../caregiver-load-index/types";
import type { EmotionalLoadSignalLayerResult } from "../emotional-load-signal/types";
import type { MoralInjurySignal } from "./types";
import type { EmotionalContradictionLoop } from "./types";

type ContradictionRule = {
  category: EmotionalContradictionLoop["category"];
  left: RegExp;
  right: RegExp;
  summary: string;
  severity: EmotionalContradictionLoop["severity"];
};

const EMOTIONAL_CONTRADICTION_RULES: readonly ContradictionRule[] = [
  {
    category: "obligation_vs_burnout",
    left: /\b(?:must|have to|should|need to) (?:keep|continue|do everything)\b/i,
    right: /\b(?:burned out|burnout|exhausted|can'?t go on|breaking down|empty)\b/i,
    summary: "Care obligation pressure conflicts with burnout exhaustion",
    severity: "HIGH",
  },
  {
    category: "obligation_vs_burnout",
    left: /\bi owe (?:them|him|her)\b/i,
    right: /\bno energy left\b/i,
    summary: "Moral debt framing conflicts with depleted capacity",
    severity: "HIGH",
  },
  {
    category: "denial_vs_medical_reality",
    left: /\b(?:fine|nothing wrong|overreacting|not that bad)\b/i,
    right: /\b(?:doctor|hospital|diagnosis|medication|symptoms|decline|dementia|fall)\b/i,
    summary: "Denial language conflicts with documented medical reality",
    severity: "CRITICAL",
  },
  {
    category: "denial_vs_medical_reality",
    left: /\brefuses to (?:accept|believe|admit)\b/i,
    right: /\b(?:test results|prognosis|specialist|treatment plan)\b/i,
    summary: "Refusal to accept conflicts with medical evidence",
    severity: "HIGH",
  },
  {
    category: "attachment_vs_harm",
    left: /\b(?:love|can'?t leave|won'?t put (?:them|him|her) in|promised to stay)\b/i,
    right: /\b(?:unsafe|harm|violence|neglect|wandering|self[- ]harm|abuse)\b/i,
    summary: "Attachment commitment conflicts with safety harm signals",
    severity: "CRITICAL",
  },
  {
    category: "attachment_vs_harm",
    left: /\bkeep (?:them|him|her) (?:home|with me)\b/i,
    right: /\b(?:injury|emergency|911|unsafe at home)\b/i,
    summary: "Home attachment conflicts with acute harm indicators",
    severity: "HIGH",
  },
  {
    category: "duty_vs_self_preservation",
    left: /\b(?:duty|responsible for everything|only one who can)\b/i,
    right: /\b(?:my health|my marriage|my job|losing myself|need a break)\b/i,
    summary: "Total duty framing conflicts with self-preservation needs",
    severity: "HIGH",
  },
  {
    category: "duty_vs_self_preservation",
    left: /\bnever (?:rest|stop|take time off)\b/i,
    right: /\b(?:collapse|health failing|can'?t sleep|panic|anxiety attack)\b/i,
    summary: "Non-stop duty conflicts with caregiver health collapse",
    severity: "CRITICAL",
  },
];

function corpus(params: {
  userInput?: string;
  assumptionHints?: readonly string[];
  memoryLabels?: readonly string[];
}): string {
  return [
    params.userInput ?? "",
    ...(params.assumptionHints ?? []),
    ...(params.memoryLabels ?? []),
  ]
    .join(" ")
    .toLowerCase();
}

export type DetectEmotionalContradictionParams = {
  userInput?: string;
  assumptionHints?: readonly string[];
  memoryLabels?: readonly string[];
  caregiverLoad?: CaregiverLoad;
  emotionalLoad?: EmotionalLoadSignalLayerResult;
  moralInjury?: MoralInjurySignal;
  openConflictCount?: number;
};

/**
 * Detect structural emotional contradiction loops — PRIMARY differentiator behavior trigger.
 */
export function detectEmotionalContradictionLoops(
  params: DetectEmotionalContradictionParams,
): EmotionalContradictionLoop[] {
  const text = corpus(params);
  if (!text.trim()) return [];

  const loops: EmotionalContradictionLoop[] = [];
  const seen = new Set<string>();

  for (const rule of EMOTIONAL_CONTRADICTION_RULES) {
    if (!rule.left.test(text) || !rule.right.test(text)) continue;
    const key = `${rule.category}|${rule.summary}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const loadAmplifier =
      params.caregiverLoad?.state === "CRITICAL" ||
      params.caregiverLoad?.state === "HIGH" ||
      params.moralInjury?.severity === "HIGH" ||
      params.moralInjury?.severity === "CRITICAL";

    loops.push({
      id: randomUUID(),
      category: rule.category,
      summary: rule.summary,
      severity: loadAmplifier && rule.severity === "HIGH" ? "CRITICAL" : rule.severity,
      triggersBehaviorChange: true,
    });
  }

  // Compound loop: high CLI + moral injury + open conflicts without explicit text pair
  if (
    loops.length === 0 &&
    (params.moralInjury?.severity === "HIGH" || params.moralInjury?.severity === "CRITICAL") &&
    (params.openConflictCount ?? 0) >= 1 &&
    (params.caregiverLoad?.score ?? 0) >= 70
  ) {
    loops.push({
      id: randomUUID(),
      category: "obligation_vs_burnout",
      summary: "High emotional contradiction loop detected — obligation pressure under critical load",
      severity: "HIGH",
      triggersBehaviorChange: true,
    });
  }

  return loops;
}

/** Format for conflict-detection soft flags */
export function emotionalContradictionHints(
  loops: readonly EmotionalContradictionLoop[],
): string[] {
  return loops.map((l) => `emotional_contradiction: ${l.summary}`);
}
