/** Canonical risk levels — lowercase per Final System Spec (uppercase accepted at boundary). */
export const SOLENOS_RISK_LEVELS = ["low", "medium", "high", "critical"] as const;

export type SolenOSRiskLevel = (typeof SOLENOS_RISK_LEVELS)[number];

export const RISK_LEVEL_DEFINITIONS = {
  low: "minimal urgency",
  medium: "requires attention",
  high: "urgent concern",
  critical: "possible emergency requiring immediate escalation",
} as const;

const LEGACY_UPPERCASE_MAP: Record<string, SolenOSRiskLevel> = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical",
};

/** Normalize risk values at validation boundary — accepts legacy uppercase and canonical lowercase. */
export function normalizeRiskLevel(value: unknown): SolenOSRiskLevel | null {
  if (typeof value !== "string") return null;
  if ((SOLENOS_RISK_LEVELS as readonly string[]).includes(value)) {
    return value as SolenOSRiskLevel;
  }
  const upper = value.toUpperCase();
  if (upper in LEGACY_UPPERCASE_MAP) {
    return LEGACY_UPPERCASE_MAP[upper];
  }
  return LEGACY_UPPERCASE_MAP[value] ?? null;
}

export const RISK_RANK: Record<SolenOSRiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};
