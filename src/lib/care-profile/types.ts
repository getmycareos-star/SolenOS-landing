import type {

  CARE_GRAPH_ROLES,

  CARE_PROFILE_UPDATE_MODES,

  TIME_SENSITIVITIES,

  WORKLOAD_INTENSITIES,

} from "./contract-constants";



export type CareGraphRole = (typeof CARE_GRAPH_ROLES)[number];

export type WorkloadIntensity = (typeof WORKLOAD_INTENSITIES)[number];

export type TimeSensitivity = (typeof TIME_SENSITIVITIES)[number];

export type CareProfileUpdateMode = (typeof CARE_PROFILE_UPDATE_MODES)[number];



export type CareProfile = {

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



export type CareProfileConflictField =
  | keyof CareProfile
  | "careRelationships.dependents"
  | "roleInCareGraph";

export type CareProfileConflict = {
  field: CareProfileConflictField;

  storedValue: unknown;

  inferredValue: unknown;

  detectedAt: string;

  resolved: boolean;

};



export type CareProfileVersion = {

  version: number;

  profile: CareProfile;

  updatedAt: string;

  updateMode: CareProfileUpdateMode;

  confidence: number;

  reason: string;

};



export type CareProfileState = {

  userId: string;

  currentVersion: number;

  profile: CareProfile;

  history: CareProfileVersion[];

  pendingConflicts: CareProfileConflict[];

  inferenceSignalCounts: Record<string, number>;

};



export type InferenceSignal = {

  kind:

    | "dependency_language"

    | "medication_pattern"

    | "mobility_pattern"

    | "shared_care_language"

    | "external_caregiver_language"

    | "user_confirmed_role"

    | "user_confirmed_dependent";

  confidence: number;

  detail: string;

  partial?: Partial<CareProfile>;

};



export type CareProfileWeightEnvelope = {

  roleWeight: number;

  urgencyPrioritization: number;

  emotionalSensitivity: number;

  timeHorizonWeight: number;

  suggestionExpansion: number;

  notificationIntensity: number;

  compressionFactor: number;

};



export type CareProfileSystemGuaranteeResult = {

  ok: boolean;

  violations: string[];

};



export type CareProfileLayerResult = {

  state: CareProfileState;

  envelope: CareProfileWeightEnvelope;

  appliedUpdates: readonly CareProfileVersion[];

  guarantee: CareProfileSystemGuaranteeResult;

};



export type CareProfileLayerPayload = {

  roleInCareGraph: CareGraphRole;

  workloadIntensity: WorkloadIntensity;

  timeSensitivity: TimeSensitivity;

  currentVersion: number;

  pendingConflictCount: number;

  envelope: CareProfileWeightEnvelope;

};


