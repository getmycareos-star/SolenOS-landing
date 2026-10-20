import type { CaregiverLoadStateForTrust, RecommendationExplanation } from "./types";
import { EMOTIONAL_READABILITY_LOAD_STATES } from "./contract-constants";

const JARGON_PATTERNS: readonly { pattern: RegExp; replacement: string }[] = [
  { pattern: /\bPriorityContract\b/gi, replacement: "priority ranking" },
  { pattern: /\bSAFETY_OVERRIDE(?:=CRITICAL×NOW)?\b/gi, replacement: "urgent safety rule" },
  { pattern: /\bCRITICAL×NOW\b/gi, replacement: "critical and immediate" },
  { pattern: /\btopSituation=\S+/gi, replacement: "the top situation" },
  { pattern: /\bsystemRisk=\S+/gi, replacement: "overall risk" },
  { pattern: /\bscore=\S+/gi, replacement: "" },
  { pattern: /\brisk=\S+/gi, replacement: "" },
  { pattern: /\btime=\S+/gi, replacement: "" },
  { pattern: /\buncertainty=\S+/gi, replacement: "missing details" },
  { pattern: /\bdependency=\S+/gi, replacement: "" },
  { pattern: /\bcompletion[−\-]\S+/gi, replacement: "" },
  { pattern: /\bmissing_information\b/gi, replacement: "missing details" },
  { pattern: /\bHIGH\b/g, replacement: "high" },
  { pattern: /\bCLI\b/g, replacement: "load check" },
  { pattern: /\s{2,}/g, replacement: " " },
  { pattern: /\s;+/g, replacement: ";" },
  { pattern: /^[;\s]+|[;\s]+$/g, replacement: "" },
];

export function shouldApplyEmotionalReadability(params: {
  caregiverLoadState?: CaregiverLoadStateForTrust;
  emotionalStress?: boolean;
}): boolean {
  if (params.emotionalStress) return true;
  const state = params.caregiverLoadState;
  if (!state) return false;
  return (EMOTIONAL_READABILITY_LOAD_STATES as readonly string[]).includes(state);
}

/** Strip internal system language from caregiver-facing text. */
export function stripSystemJargon(text: string): string {
  let out = text;
  for (const { pattern, replacement } of JARGON_PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  return out.replace(/\s{2,}/g, " ").trim();
}

function shortenSentence(text: string, maxWords: number): string {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text;
  return `${words.slice(0, maxWords).join(" ")}.`;
}

/**
 * Emotional readability mode — further simplify under HIGH/CRITICAL load or emotional stress.
 * Deterministic string transforms only (no LLM).
 */
export function simplifyExplanationForLoad(
  explanation: RecommendationExplanation,
  params: {
    caregiverLoadState?: CaregiverLoadStateForTrust;
    emotionalStress?: boolean;
  },
): RecommendationExplanation {
  if (!shouldApplyEmotionalReadability(params)) {
    return {
      whyThisWasChosen: stripSystemJargon(explanation.whyThisWasChosen),
      whatWasIgnored: explanation.whatWasIgnored.map(stripSystemJargon),
      riskIfIgnored: stripSystemJargon(explanation.riskIfIgnored),
    };
  }

  const why = shortenSentence(
    stripSystemJargon(explanation.whyThisWasChosen),
    18,
  );
  const ignored = explanation.whatWasIgnored
    .map(stripSystemJargon)
    .slice(0, 2)
    .map((item) => shortenSentence(item, 10));
  const risk = shortenSentence(stripSystemJargon(explanation.riskIfIgnored), 16);

  return {
    whyThisWasChosen: why || "This was the most urgent next step.",
    whatWasIgnored:
      ignored.length > 0 ? ignored : ["Other lower-pressure items can wait."],
    riskIfIgnored: risk || "Waiting could make the situation harder to handle.",
  };
}
