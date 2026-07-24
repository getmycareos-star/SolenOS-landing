import type { CAREGIVER_LOAD_ENGINE_FORBIDDEN } from "./contract-constants";
import type { DependencyStage } from "./dementia-context";

/** Five load dimensions + burnout — master product contract. */
export type LoadDimension =
  | "cognitiveLoad"
  | "emotionalLoad"
  | "sleepLoad"
  | "uncertaintyLoad"
  | "dependencyLoad";

export type LoadSignalFamily =
  | "repetition"
  | "sleep"
  | "emotionalDistress"
  | "uncertainty"
  | "supervision"
  | "assistance"
  | "vigilance"
  | "burnoutLanguage";

export type DetectedLoadSignalFamilies = {
  repetition: number;
  sleep: number;
  emotionalDistress: number;
  uncertainty: number;
  supervision: number;
  assistance: number;
  vigilance: number;
  burnoutLanguage: number;
  matchedFamilies: LoadSignalFamily[];
};

export type LoadScores = {
  cognitiveLoadScore: number;
  emotionalLoadScore: number;
  sleepRiskScore: number;
  uncertaintyIndex: number;
  dependencyLoadScore: number;
};

export type BurnoutTrend = "stable" | "rising" | "critical";

export type BurnoutTier = "Low" | "Moderate" | "High" | "Critical";

export type BurnoutModel = {
  probability: number;
  trend: BurnoutTrend;
  tier: BurnoutTier;
  acuteTriggered: boolean;
  reasoning: string;
};

export type ActionReductionStrategy = {
  maxActions: number;
  loadFirstMode: boolean;
  suppressEducation: boolean;
  prioritizeSleepProtection: boolean;
  surfaceToday: readonly string[];
  hideUntilReady: readonly string[];
  acknowledgment?: string;
};

export type CaregiverProfile = {
  role: string;
  durationMonths: number | null;
  environment: "home" | "facility" | "mixed" | "unknown";
  dependencyStage: DependencyStage;
};

export type CaregiverState = {
  scores: LoadScores;
  burnout: BurnoutModel;
  loadFirstMode: boolean;
  burdenStatements: readonly string[];
  primaryContributors: readonly string[];
  actionReduction: ActionReductionStrategy;
  dependencyStage: DependencyStage;
  signals: DetectedLoadSignalFamilies;
};

export type CaregiverLoadEngineLayerPayload = {
  cognitiveLoadScore: number;
  emotionalLoadScore: number;
  sleepRiskScore: number;
  uncertaintyIndex: number;
  dependencyLoadScore: number;
  burnoutProbability: number;
  burnoutTrend: BurnoutTrend;
  burnoutTier: BurnoutTier;
  acuteBurnoutTriggered: boolean;
  loadFirstMode: boolean;
  burdenSummary: string;
  primaryContributors: readonly string[];
  dependencyStage: DependencyStage;
  maxActions: number;
};

/** Backward-compatible load interpretation slice for ELS / output shaping. */
export type CaregiverLoadEngineLoadInterpretation = {
  emotionalLoadScore: number;
  sleepRisk: number;
  burnoutProbability: number;
  uncertaintyIndex: number;
  primaryContributors: string[];
  burdenSummary: string;
  loadFirstMode: boolean;
};

export type CaregiverLoadEngineResult = {
  state: CaregiverState;
  loadInterpretation: CaregiverLoadEngineLoadInterpretation;
  guarantee: { ok: boolean; violations: string[] };
};

export type CaregiverLoadEngineForbidden = (typeof CAREGIVER_LOAD_ENGINE_FORBIDDEN)[number];
