import type { LOAD_INTERPRETATION_FORBIDDEN } from "./contract-constants";

export type LoadSignalCategory =
  | "emotionalLoad"
  | "sleepRisk"
  | "uncertaintyIndex"
  | "cognitiveLoad"
  | "burnoutProbability";

export type DetectedLoadSignals = {
  emotionalLoad: number;
  sleepRisk: number;
  uncertaintyIndex: number;
  cognitiveLoad: number;
  burnoutProbability: number;
  matchedCategories: LoadSignalCategory[];
};

export type LoadInterpretation = {
  emotionalLoadScore: number;
  sleepRisk: number;
  burnoutProbability: number;
  uncertaintyIndex: number;
  primaryContributors: string[];
  burdenSummary: string;
  loadFirstMode: boolean;
};

export type LoadInterpretationBoost = {
  uncertaintyLoadBoost: number;
  conflictLoadBoost: number;
  depletionFactorBoost: number;
  emotionalBiasBoost: number;
};

export type LoadInterpretationLayerPayload = {
  emotionalLoadScore: number;
  sleepRisk: number;
  burnoutProbability: number;
  uncertaintyIndex: number;
  loadFirstMode: boolean;
  primaryContributors: readonly string[];
  burdenSummary: string;
  matchedCategoryCount: number;
};

export type LoadInterpretationForbidden = (typeof LOAD_INTERPRETATION_FORBIDDEN)[number];
