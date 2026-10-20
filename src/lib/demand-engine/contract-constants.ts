/**
 * Demand Engine (v1.5) — STATE action state attached to Situations.
 * Caregiver experiences demands, not situations.
 * pressureScore is DERIVED pure computation (effort excluded).
 */

export const DEMAND_ENGINE_IDENTITY =
  "Demand Engine converts situations into actionable demands ranked by cognitive pressure — caregiver experiences demands, not situations";

export const DEMAND_ENGINE_ONE_LINE_TRUTH =
  "Given all active situations, what specifically requires attention right now? Demands are STATE; pressureScore is derived; effort never increases priority.";

export const DEMAND_ENGINE_PIPELINE_POSITION =
  "Situation → Demand Engine → Caregiver Load Index → Priority → Decision → Safety → Decision Surface";

export const DEMAND_ENGINE_FORBIDDEN = [
  "ranking situations instead of demands",
  "persisting pressureScore as independent system of record",
  "using effort to increase priority / pressureScore",
  "deleting completed demands (timeline/explanation history)",
  "treating Caregiver Load Index as demand generation",
] as const;

export const DEMAND_STATUSES = [
  "pending",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export const DEMAND_CATEGORIES = [
  "medical",
  "care_coordination",
  "financial",
  "legal",
  "home_safety",
  "transportation",
  "family_conflict",
  "monitoring",
] as const;

/** Pressure formula weights — effort EXCLUDED. */
export const PRESSURE_WEIGHTS = {
  urgency: 0.35,
  riskImpact: 0.35,
  uncertainty: 0.2,
  emotionalLoad: 0.1,
} as const;

/** Default Decision Surface window when load state unknown. */
export const DEFAULT_SURFACE_DEMAND_COUNT = 2;

/** High-pressure threshold for CLI highPressureDemandCount. */
export const HIGH_PRESSURE_THRESHOLD = 70;
