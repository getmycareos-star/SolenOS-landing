import type { ResponseRiskLevel } from "./types";

/**
 * Caregiver-facing attention language from Response Contract risk_level.
 * Never scores, %, confidence theater, or "risk_level" enum chrome.
 * SoT: docs/02-product/solenos-response-contract.md § Risk level
 */
export const ATTENTION_LABELS_BY_RISK = {
  low: "Can wait — not the main focus from what is held",
  medium: "Worth attention from what is held",
  high: "Needs attention now from what is held",
} as const satisfies Record<ResponseRiskLevel, string>;

export function humanAttentionLabelFor(risk: ResponseRiskLevel): string {
  return ATTENTION_LABELS_BY_RISK[risk];
}

/** Disclosure: show attention when consequence warrants — never dump Low on every first note. */
export function shouldDiscloseAttentionLevel(params: {
  risk: ResponseRiskLevel;
  disclosureStage: "early" | "growing" | "established";
}): boolean {
  if (params.risk === "high") return true;
  if (params.risk === "medium") return true;
  // Low: only once understanding has room to orient (growing+)
  return params.disclosureStage !== "early";
}

/** Reject score / percentage theater in caregiver attention copy. */
export function containsAttentionScoreTheater(text: string): boolean {
  return (
    /\b\d{1,3}\s*%\b/.test(text) ||
    /\bconfidence\s*(score|level|%)\b/i.test(text) ||
    /\brisk_level\b/i.test(text) ||
    /\brisk\s*score\b/i.test(text)
  );
}
