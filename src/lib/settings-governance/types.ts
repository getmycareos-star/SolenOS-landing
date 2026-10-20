import type {

  CareGraphRole,

  DecisionAuthorityLevel,

  EmergencySensitivity,

  SafetyRiskToleranceLevel,

  EmotionalMode,

  GovernanceConstraintKind,

  MedicalMode,

  MemoryVisibility,

  NotificationDigestMode,

  NotificationUrgencyFilter,

  ReasoningVisibility,

  SystemMode,

  TimeSensitivity,

  WorkloadIntensity,

} from "./types-derived";



export type {

  CareGraphRole,

  DecisionAuthorityLevel,

  EmergencySensitivity,

  SafetyRiskToleranceLevel,

  EmotionalMode,

  GovernanceConstraintKind,

  MedicalMode,

  MemoryVisibility,

  NotificationDigestMode,

  NotificationUrgencyFilter,

  ReasoningVisibility,

  SystemMode,

  TimeSensitivity,

  WorkloadIntensity,

};



export type CareContextProfile = {

  roleInCareGraph: CareGraphRole;

  careRelationships: {

    dependents: string[];

    sharedCareWith: string[];

    externalCaregivers: string[];

  };

  conditionSignals: {

    medicationReminders: boolean;

    mobilityAssistance: boolean;

  };

  workloadIntensity: WorkloadIntensity;

  timeSensitivity: TimeSensitivity;

};



/** System Settings — memory weighting and access gates (control plane only). */

export type MemoryControl = {

  identityMemoryWeight: number;

  patternMemoryWeight: number;

  operationalMemoryWeight: number;

  emotionalMemoryWeight: number;

  inferenceFromBehavior: boolean;

  allowMemoryWrite: boolean;

  allowMemoryRead: boolean;

};



/** Legacy memory governance shape — accepted at parse time, migrated to MemoryControl. */

export type LegacyMemoryControlsInput = {

  identityMemory?: boolean;

  longTermPatternMemory?: boolean;

  operationalMemory?: boolean;

  emotionalMemory?: boolean;

  visibility?: MemoryVisibility;

  deletionControls?: {

    allowFullDelete: boolean;

    allowCategoryDelete: boolean;

  };

  tagging?: {

    outdated: boolean;

    incorrect: boolean;

    sensitive: boolean;

  };

  inferenceFromBehavior?: boolean;

};



export type DecisionControl = {

  level: DecisionAuthorityLevel;

  requireConfirmationForHighRisk: boolean;

  showAlternatives: boolean;

  reasoningVisibility: ReasoningVisibility;

  manualOverrideEnabled: boolean;

};



export type TimeControl = {

  timezoneDetection: boolean;

  coarseLocationEnabled: boolean;

  strictTimeHorizonMode: boolean;

  timeHorizonModel: {

    NOW: string;

    TODAY: string;

    SOON: string;

    LATER: string;

  };

};



export type EmotionalControl = {

  emotionalLoadDetection: boolean;

  burnoutDetection: boolean;

  griefSensitivity: boolean;

  overloadSimplification: boolean;

  mode: EmotionalMode;

};



export type NotificationControl = {

  urgencyFilter: NotificationUrgencyFilter;

  quietHoursEnabled: boolean;

  emergencyOverride: boolean;

  digestMode: NotificationDigestMode;

};



export type PrivacyControl = {

  exportEnabled: boolean;

  deleteAccountEnabled: boolean;

  disableInferenceEngine: boolean;

  disableBehaviorSignals: boolean;

  allowBehaviorInference: boolean;

};



export type TransparencyControl = {

  reasoningVisibility: ReasoningVisibility;

  uncertaintyDisplay: boolean;

  confidenceDisplay: boolean;

  showAlternatives: boolean;

};



export type SafetyControl = {

  medicalMode: MedicalMode;

  emergencySensitivity: EmergencySensitivity;

  externalEscalationEnabled: boolean;

  alwaysShowUncertainty: boolean;

  noCertaintyMode: boolean;

  riskTolerance: SafetyRiskToleranceLevel;

};



/** Global system settings control plane — configures downstream execution behavior only. */

export type SolenOSSettings = {

  systemMode: SystemMode;

  decisionControl: DecisionControl;

  memoryControl: MemoryControl;

  emotionalControl: EmotionalControl;

  timeControl: TimeControl;

  safetyControl: SafetyControl;

  transparencyControl: TransparencyControl;

  notificationControl: NotificationControl;

  privacyControl: PrivacyControl;

  /** Care profile mirror — settings consume profile weights; not the source of truth. */

  careContext: CareContextProfile;

};



/** @deprecated Use MemoryControl */

export type MemoryControls = MemoryControl;

/** @deprecated Use DecisionControl */

export type DecisionAuthority = DecisionControl;

/** @deprecated Use TimeControl */

export type TimeControls = TimeControl;

/** @deprecated Use EmotionalControl */

export type EmotionalControls = EmotionalControl;

/** @deprecated Use NotificationControl */

export type NotificationControls = NotificationControl;

/** @deprecated Use PrivacyControl */

export type PrivacyControls = PrivacyControl;

/** @deprecated Use TransparencyControl */

export type TransparencyControls = TransparencyControl;

/** @deprecated Use SafetyControl */

export type SafetyControls = SafetyControl;



export type ModuleActivationState = {

  memory: boolean;

  emotional: boolean;

  time: boolean;

  priority: boolean;

  safety: boolean;

  notification: boolean;

};



export type ModuleWeights = {

  memory: number;

  emotional: number;

  time: number;

  priority: number;

  safety: number;

  notification: number;

};



export type GovernanceRoutingContext = {

  inferenceDepth: "shallow" | "standard" | "deep";

  riskTolerance: "low" | "medium" | "high";

  decisionAutonomy: DecisionAuthorityLevel;

  notificationEligible: boolean;

  memoryInfluenceLevel: MemoryVisibility;

  transparencyRouting: {

    reasoningVisibility: ReasoningVisibility;

    uncertaintyDisplay: boolean;

    confidenceDisplay: boolean;

    showAlternatives: boolean;

  };

};



export type AppliedGovernanceConstraint = {

  kind: GovernanceConstraintKind;

  detail: string;

};



export type SystemBehaviorGuaranteeResult = {

  ok: boolean;

  violations: string[];

};



export type GovernanceApplicationResult = {

  response: import("../response-validator").SolenOSResponse;

  originalResponse: import("../response-validator").SolenOSResponse;

  settings: SolenOSSettings;

  moduleActivation: ModuleActivationState;

  moduleWeights: ModuleWeights;

  routing: GovernanceRoutingContext;

  appliedConstraints: readonly AppliedGovernanceConstraint[];

  guarantee: SystemBehaviorGuaranteeResult;

};



export type GovernanceLayerPayload = {

  systemMode: SystemMode;

  routing: GovernanceRoutingContext;

  moduleActivation: ModuleActivationState;

  appliedConstraints: readonly AppliedGovernanceConstraint[];

};


