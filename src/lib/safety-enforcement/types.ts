import type {
  ALLOWED_SAFETY_CONSTRAINTS,
  ESCALATION_MATRIX_ACTIONS,
  SAFETY_EMERGENCY_SENSITIVITIES,
  SAFETY_MEDICAL_MODES,
  SAFETY_RISK_TOLERANCE_LEVELS,
} from "./contract-constants";
import type { SolenOSRiskLevel } from "../implementation-enforcement/risk-levels";
import type { CareContextUrgencyLevel } from "../care-context/situational/types";
import type { OverloadSimplificationSignals } from "../situation-risk-register/types";

export type SafetyRiskTolerance = (typeof SAFETY_RISK_TOLERANCE_LEVELS)[number];

export type SafetyMedicalMode = (typeof SAFETY_MEDICAL_MODES)[number];

export type SafetyEmergencySensitivity = (typeof SAFETY_EMERGENCY_SENSITIVITIES)[number];

export type SafetyConstraintKind = (typeof ALLOWED_SAFETY_CONSTRAINTS)[number];

export type EscalationMatrixAction = (typeof ESCALATION_MATRIX_ACTIONS)[number];

/** Deterministic execution constraint model — NOT UI preferences or disclaimer content. */
export type SolenOSSafetyControl = {
  medicalMode: SafetyMedicalMode;
  emergencySensitivity: SafetyEmergencySensitivity;
  externalEscalationEnabled: boolean;
  alwaysShowUncertainty: boolean;
  noCertaintyMode: boolean;
  riskTolerance: SafetyRiskTolerance;
};

export type AppliedSafetyConstraint = {
  kind: SafetyConstraintKind;
  detail: string;
};

export type SafetyEscalationContext = {
  /** Validated response risk level — post-reasoning only. */
  responseRiskLevel: SolenOSRiskLevel;
  /** Situational care context urgency — read-only input. */
  careContextUrgency?: CareContextUrgencyLevel;
  /** Whether situational context indicates emergency. */
  emergencySituation?: boolean;
  /** Memory composite influence — read-only; higher may suggest lower perceived risk. */
  memoryCompositeInfluence?: number;
  /** Emotional distress signal from memory envelope — read-only. */
  emotionalDistressSignal?: boolean;
  /** Situation Risk Register overload — simplify / reduce autonomy when HIGH. */
  overloadSimplification?: OverloadSimplificationSignals;
};

export type SafetySystemGuaranteeResult = {
  ok: boolean;
  violations: string[];
};

export type SafetyEnforcementResult = {
  response: import("../response-validator").SolenOSResponse;
  originalResponse: import("../response-validator").SolenOSResponse;
  control: SolenOSSafetyControl;
  effectiveRiskLevel: SolenOSRiskLevel;
  escalationAction: EscalationMatrixAction;
  emergencyOverrideActive: boolean;
  appliedConstraints: readonly AppliedSafetyConstraint[];
  guarantee: SafetySystemGuaranteeResult;
};

export type SafetyLayerPayload = {
  medicalMode: SafetyMedicalMode;
  emergencySensitivity: SafetyEmergencySensitivity;
  externalEscalationEnabled: boolean;
  effectiveRiskLevel: SolenOSRiskLevel;
  escalationAction: EscalationMatrixAction;
  emergencyOverrideActive: boolean;
  appliedConstraints: readonly AppliedSafetyConstraint[];
};
