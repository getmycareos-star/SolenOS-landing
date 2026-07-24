import type { SolenOSRiskLevel } from "../implementation-enforcement/risk-levels";

/** Section 4.2 — CRITICAL triggers (explicit only). */
export const CRITICAL_URGENCY_SIGNALS = [
  /\bnot breathing\b/i,
  /\bcannot breathe\b/i,
  /\bcan'?t breathe\b/i,
  /\bunconscious\b/i,
  /\bpassed out\b/i,
  /\bseizure\b/i,
  /\bstroke symptoms?\b/i,
  /\bactive self[- ]harm\b/i,
  /\bself[- ]harm\b/i,
  /\bsuicid(?:al|e)\b/i,
] as const;

/** Section 4.3 — HIGH triggers. */
export const HIGH_URGENCY_SIGNALS = [
  /\bworsening symptoms?\b/i,
  /\bsevere confusion\b/i,
  /\brepeated falls?\b/i,
  /\bchest pain\b/i,
  /\brapidly worsening\b/i,
  /\binability to wake\b/i,
  /\bcan'?t wake\b/i,
  /\buncontrolled bleeding\b/i,
  /\bsevere bleeding\b/i,
] as const;

export interface UrgencyDetectionResult {
  risk_level: SolenOSRiskLevel;
  critical_signals: string[];
  high_signals: string[];
  detection_method: "rule_match" | "contextual_confirmation" | "default";
}
