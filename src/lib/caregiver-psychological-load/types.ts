import type {
  CAREGIVER_PSYCHOLOGICAL_LOAD_FORBIDDEN,
  IDENTITY_DRIFT_LEVEL_ORDER,
  MORAL_INJURY_SEVERITY_ORDER,
} from "./contract-constants";

export type MoralInjurySeverity = (typeof MORAL_INJURY_SEVERITY_ORDER)[number];

export type MoralInjurySignal = {
  severity: MoralInjurySeverity;
  /** guilt, self-blame, "should handle this", moral exhaustion */
  indicators: string[];
  /** 0–1 contribution to composite load */
  contributionToLoad: number;
  explanation: string;
};

export type IdentityDriftLevel = (typeof IDENTITY_DRIFT_LEVEL_ORDER)[number];

export type IdentityDriftState = {
  driftLevel: IdentityDriftLevel;
  signals: string[];
  explanation: string;
};

export type EmotionalValidation = {
  message: string;
  triggerReason: string;
  normalizeExperience: boolean;
};

export type EmotionalContradictionLoop = {
  id: string;
  /** Structural conflict category */
  category:
    | "obligation_vs_burnout"
    | "denial_vs_medical_reality"
    | "attachment_vs_harm"
    | "duty_vs_self_preservation";
  summary: string;
  severity: "MEDIUM" | "HIGH" | "CRITICAL";
  /** When true, triggers containment behavior change */
  triggersBehaviorChange: boolean;
};

export type ContainmentMode = {
  engaged: boolean;
  reason: string;
  maxActions: number;
  suppressTaskExpansion: boolean;
  prioritizeEmotionalStabilization: boolean;
  emphasizeWhatCanWait: boolean;
  /** Load-reducer: what can be ignored safely today */
  whatNotToDoToday: string[];
  /** When true, acute burnout pattern triggered containment — non-prescriptive posture. */
  acuteBurnoutTriggered?: boolean;
};

export type EmotionalLoadScoreLevel = "LOW" | "MEDIUM" | "HIGH";

export type SleepDisruptionRisk = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type UncertaintyIndex = "LOW" | "MEDIUM" | "HIGH";

export type SafetyStressEnvironmentFlag = boolean;

export type AcuteCaregiverBurnoutRiskState = boolean;

export type HighSignalStressPatternResult = {
  emotionalLoadScore: EmotionalLoadScoreLevel;
  sleepDisruptionRisk: SleepDisruptionRisk;
  uncertaintyIndex: UncertaintyIndex;
  safetyStressEnvironmentFlag: SafetyStressEnvironmentFlag;
  acuteCaregiverBurnoutRiskState: AcuteCaregiverBurnoutRiskState;
  signals: {
    emotionalHarm: { detected: boolean; indicators: readonly string[] };
    sleepDisruption: { detected: boolean; indicators: readonly string[] };
    uncertaintyOverload: { detected: boolean; indicators: readonly string[] };
  };
  groundingMessage: string | null;
  explanation: string;
};

export type HighSignalStressLayerPayload = {
  emotionalLoadScore: EmotionalLoadScoreLevel;
  sleepDisruptionRisk: SleepDisruptionRisk;
  uncertaintyIndex: UncertaintyIndex;
  safetyStressEnvironmentFlag: SafetyStressEnvironmentFlag;
  acuteCaregiverBurnoutRiskState: AcuteCaregiverBurnoutRiskState;
  containmentModeEngaged: boolean;
  groundingMessage: string | null;
};

export type CaregiverPsychologicalLoadGuaranteeResult = {
  ok: boolean;
  violations: string[];
};

export type CaregiverPsychologicalLoadResult = {
  moralInjury: MoralInjurySignal;
  identityDrift: IdentityDriftState;
  emotionalContradictionLoops: readonly EmotionalContradictionLoop[];
  containmentMode: ContainmentMode;
  /** Populated when triggers fire — EXPLANATION adjunct; does not change STATE */
  emotionalValidation: EmotionalValidation | null;
  highSignalStress: HighSignalStressPatternResult;
  guarantee: CaregiverPsychologicalLoadGuaranteeResult;
};

export type CaregiverPsychologicalLoadPayload = {
  moralInjurySeverity: MoralInjurySeverity;
  moralInjuryContribution: number;
  identityDriftLevel: IdentityDriftLevel;
  emotionalContradictionLoopCount: number;
  containmentEngaged: boolean;
  emotionalValidationTriggered: boolean;
  emotionalValidationMessage: string | null;
  whatNotToDoToday: readonly string[];
  guaranteeOk: boolean;
  acuteCaregiverBurnoutRiskState: boolean;
  highSignalStressEngaged: boolean;
};

export type CaregiverPsychologicalLoadForbidden =
  (typeof CAREGIVER_PSYCHOLOGICAL_LOAD_FORBIDDEN)[number];
