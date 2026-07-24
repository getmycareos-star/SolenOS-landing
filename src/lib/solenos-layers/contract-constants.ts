/**
 * SolenOS 3-Layer Architecture — NON-NEGOTIABLE.
 * EVERYTHING belongs to exactly one of: STATE | BELIEF | EXPLANATION.
 * Derived values (risk, priority, health) are pure functions over STATE + BELIEF only.
 */

export const SOLENOS_LAYERS_IDENTITY =
  "SolenOS is a single system with three layers: STATE (truth), BELIEF (uncertainty), EXPLANATION (why/audit) — plus pure derived computations";

export const SOLENOS_LAYERS_ONE_LINE_TRUTH =
  "ONLY STATE + BELIEF persist. Risk, priority, demand pressure, caregiver load, and health are derived. Explanation is post-hoc and never influences decisions.";

export const SOLENOS_LAYER_NAMES = ["STATE", "BELIEF", "EXPLANATION"] as const;

export const SOLENOS_RUNTIME_PIPELINE = [
  "INPUT",
  "STATE_UPDATE",
  "BELIEF_UPDATE",
  "DERIVED_COMPUTATION",
  "ACTION_SELECTION",
  "EXPLANATION_OUTPUT",
] as const;

export const SOLENOS_LAYERS_FORBIDDEN = [
  "independent Risk Engine / Situation Risk Register as stored system",
  "Assumption Engine and Missing Info Engine as parallel systems",
  "Priority Engine as persistent standalone system",
  "Health Engine as active decision-influencing system",
  "Caregiver Load Index as persistent dashboard / diagnosis system",
  "duplicated truth sources for situations",
  "persistent derived databases (risk, priority, health, load, pressure)",
  "new engines/registries/modules outside STATE|BELIEF|EXPLANATION",
] as const;

export const BELIEF_ITEM_TYPES = ["assumption", "missing_information"] as const;

export const BELIEF_ITEM_STATUSES = [
  "active",
  "invalidated",
  "confirmed",
] as const;

export const BELIEF_IMPORTANCE = ["LOW", "MEDIUM", "HIGH"] as const;

export const STATE_SITUATION_STATUSES = [
  "active",
  "resolved",
  "archived",
] as const;

export const STATE_ACTION_STATUSES = [
  "pending",
  "completed",
  "blocked",
] as const;

export const STATE_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

/** HIGH importance missing_information beliefs block high-confidence irreversible decisions. */
export const HIGH_MISSING_INFO_CONFIDENCE_CAP = 0.55;

export const DEPRECATED_FACADE_NOTICE =
  "DEPRECATED FACADE — use src/lib/solenos-layers instead. This module re-exports or thin-wraps the 3-layer architecture.";
