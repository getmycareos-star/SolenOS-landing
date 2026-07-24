import type { CAREGIVER_LOAD_STATES } from "./contract-constants";

export type CaregiverLoadState = (typeof CAREGIVER_LOAD_STATES)[number];

/**
 * Derived operational load snapshot — recomputed each pass; not a persistent engine.
 * MVP: no fatigueTrend / burnoutRisk / sleep / confidence.
 */
export type CaregiverLoad = {
  score: number;
  state: CaregiverLoadState;
  activeDemandCount: number;
  highPressureDemandCount: number;
  unresolvedSituationCount: number;
  uncertaintyLoad: number;
  conflictLoad: number;
  coordinationLoad: number;
  timePressureLoad: number;
  updatedAt: string;
};

export type CaregiverLoadInputs = {
  activeDemandCount: number;
  highPressureDemandCount: number;
  unresolvedSituationCount?: number;
  /** 0–100 from Belief / missing information. */
  uncertaintyLoad: number;
  /** 0–100 family / care-profile conflict. */
  conflictLoad: number;
  /** 0–100 coordination complexity. */
  coordinationLoad: number;
  /** 0–100 time pressure. */
  timePressureLoad: number;
  /** Optional raw formula floor from prolonged unresolved situations (0–100 contribution before normalize). */
  prolongedUnresolvedBoost?: number;
};

export type CaregiverLoadGuaranteeResult = {
  ok: boolean;
  violations: string[];
};

export type CaregiverLoadLayerPayload = {
  caregiverLoadState: CaregiverLoadState;
  caregiverLoadScore: number;
  surfaceLimit: number;
  activeDemandCount: number;
  highPressureDemandCount: number;
  guaranteeOk: boolean;
};

export type CaregiverLoadLayerResult = {
  load: CaregiverLoad;
  surfaceLimit: number;
  guarantee: CaregiverLoadGuaranteeResult;
};
