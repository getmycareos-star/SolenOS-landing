import type {
  INTERACTION_LOAD_FLAG_DESCRIPTIONS,
  INTERACTION_LOAD_SIGNAL_FORBIDDEN,
} from "./contract-constants";

export type InteractionLoadPatternCategory =
  | "repetitiveQuestioning"
  | "redirectFailure"
  | "nighttimeInterruption"
  | "emotionalExhaustion"
  | "alwaysOnCall";

export type InteractionLoadFlag = keyof typeof INTERACTION_LOAD_FLAG_DESCRIPTIONS;

export type OutputStrategy = "normal" | "interaction_survivability";

export type SleepDisruptionRiskLevel = "LOW" | "ELEVATED" | "CRITICAL";

export type DetectedInteractionLoadSignals = {
  repetitiveQuestioning: number;
  redirectFailure: number;
  nighttimeInterruption: number;
  emotionalExhaustion: number;
  alwaysOnCall: number;
  matchedCategories: InteractionLoadPatternCategory[];
};

export type InteractionLoadMetricDeltas = {
  /** 0–100 boost to emotional load composite */
  emotionalLoadBoost: number;
  /** 0–100 boost to CLI cognitive load proxy */
  cognitiveLoadBoost: number;
  /** Sleep disruption risk level */
  sleepDisruptionRisk: SleepDisruptionRiskLevel;
  /** NEW: 0–100 boundary violation index */
  boundaryViolationIndex: number;
  conflictLoadBoost: number;
  coordinationLoadBoost: number;
};

export type SleepProtectionMode = {
  engaged: boolean;
  rationale: string;
  maxActions: number;
  suppressTaskHeavySuggestions: boolean;
  prioritizeCalmingOutput: boolean;
};

export type InteractionLoadFlagEntry = {
  code: InteractionLoadFlag;
  description: string;
};

export type InteractionLoadGuaranteeResult = {
  ok: boolean;
  violations: string[];
};

export type InteractionLoadSignalResult = {
  /** True when Caregiver Interaction Load Problem is detected */
  detected: boolean;
  systemInsight: string;
  flags: readonly InteractionLoadFlagEntry[];
  metrics: InteractionLoadMetricDeltas;
  sleepProtectionMode: SleepProtectionMode;
  outputStrategy: OutputStrategy;
  detectedSignals: DetectedInteractionLoadSignals;
  guarantee: InteractionLoadGuaranteeResult;
};

export type InteractionLoadLayerPayload = {
  detected: boolean;
  systemInsight: string;
  outputStrategy: OutputStrategy;
  sleepProtectionEngaged: boolean;
  sleepDisruptionRisk: SleepDisruptionRiskLevel;
  boundaryViolationIndex: number;
  emotionalLoadBoost: number;
  cognitiveLoadBoost: number;
  repetitionFatigue: boolean;
  boundaryStress: boolean;
  matchedCategoryCount: number;
  guaranteeOk: boolean;
};

export type InteractionLoadForbidden = (typeof INTERACTION_LOAD_SIGNAL_FORBIDDEN)[number];

export type InteractionLoadCliBoost = {
  cognitiveLoadBoost: number;
  conflictLoadBoost: number;
  coordinationLoadBoost: number;
};
