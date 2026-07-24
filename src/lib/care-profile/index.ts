export {
  CARE_PROFILE_LAYER_IDENTITY,
  CARE_PROFILE_LAYER_ONE_LINE_TRUTH,
  CARE_PROFILE_LAYER_PIPELINE_POSITION,
  CARE_PROFILE_LAYER_FORBIDDEN,
  CARE_PROFILE_UPDATE_MODES,
  CARE_GRAPH_ROLES,
  WORKLOAD_INTENSITIES,
  TIME_SENSITIVITIES,
  INFERENCE_CONFIDENCE_THRESHOLD,
  INFERENCE_SIGNAL_REPEAT_THRESHOLD,
} from "./contract-constants";

export type {
  CareGraphRole,
  WorkloadIntensity,
  TimeSensitivity,
  CareProfileUpdateMode,
  CareProfile,
  CareProfileConflict,
  CareProfileVersion,
  CareProfileState,
  InferenceSignal,
  CareProfileWeightEnvelope,
  CareProfileSystemGuaranteeResult,
  CareProfileLayerResult,
  CareProfileLayerPayload,
} from "./types";

export { DEFAULT_CARE_PROFILE, createDefaultCareProfileState } from "./defaults";

export {
  CareProfileSchema,
  CareProfileVersionSchema,
  CareProfileStateSchema,
  parseCareProfile,
  parseCareProfileState,
} from "./schema";

export {
  detectInferenceSignals,
  mergePartialProfile,
  mergeDependentsUnique,
} from "./signals";

export {
  applyInferenceSignals,
  processInputForProfileUpdate,
  rollbackToVersion,
  type ProfileUpdateResult,
} from "./update";

export {
  computeCareProfileWeightEnvelope,
  applyCareProfileBehaviorWeighting as applyBehaviorProfileWeighting,
  mergeCareProfileWithModuleWeights,
} from "./weighting";

export {
  runCareProfileSystemGuarantee,
  validateCareProfileLayerResult,
} from "./guarantee";

export {
  getDefaultCareProfileState,
  getUserCareProfileState,
  setUserCareProfileState,
  clearUserCareProfileState,
  bindCareProfileToUser,
  resetCareProfileStore,
  listAllCareProfileStates,
} from "./persistence";

export {
  toCareContextProfile,
  syncSettingsCareContextFromProfile,
  seedProfileFromSettingsCareContext,
} from "./bridge-settings";

export {
  processCareProfileLayer,
  applyCareProfileBehaviorWeighting,
  applyCareProfileGovernanceWeighting,
  toCareProfileLayerPayload,
  getCareProfileStateForUser,
  type ProcessCareProfileLayerParams,
} from "./apply-profile";
