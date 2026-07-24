export {
  MEMORY_INFLUENCE_LAYER_IDENTITY,
  MEMORY_INFLUENCE_LAYER_ONE_LINE_TRUTH,
  MEMORY_INFLUENCE_LAYER_PIPELINE_POSITION,
  MEMORY_INFLUENCE_LAYER_FORBIDDEN,
  MEMORY_UPDATE_CONDITIONS,
  MEMORY_CATEGORIES,
  MEMORY_INFERENCE_CONFIDENCE_THRESHOLD,
  MEMORY_SIGNAL_REPEAT_THRESHOLD,
  MEMORY_VISIBILITY_LEVELS,
} from "./contract-constants";

export type {
  MemoryCategory,
  MemoryUpdateCondition,
  MemoryVisibilityLevel,
  MemoryEntryTags,
  MemoryInfluenceEntry,
  IdentityMemory,
  PatternMemory,
  OperationalMemory,
  EmotionalMemory,
  MemoryCategoryWeights,
  MemoryDeletionPolicy,
  MemoryTaggingSystem,
  SolenOSMemory,
  MemoryDeletionEvent,
  MemoryInfluenceState,
  MemoryInfluenceSignal,
  MemoryInfluenceEnvelope,
  MemorySystemGuaranteeResult,
  MemoryInfluenceLayerResult,
  MemoryInfluenceLayerPayload,
} from "./types";

export { createDefaultSolenOSMemory, createDefaultMemoryInfluenceState } from "./defaults";

export { detectMemoryInfluenceSignals, signalOccurrenceKey } from "./signals";

export {
  applyMemoryInfluenceSignals,
  processInputForMemoryUpdate,
  type MemoryUpdateResult,
} from "./update";

export {
  deleteMemoryEntry,
  deleteMemoryCategory,
  deleteAllMemoryInfluence,
  tagMemoryEntry,
  type MemoryDeletionResult,
} from "./deletion";

export {
  computeMemoryInfluenceEnvelope,
  applyMemoryBehaviorWeighting,
  mergeMemoryWithModuleWeights,
} from "./weighting";

export { runMemorySystemGuarantee, validateMemoryInfluenceLayerResult } from "./guarantee";

export {
  getUserMemoryInfluenceState,
  setUserMemoryInfluenceState,
  clearUserMemoryInfluenceState,
  bindMemoryInfluenceToUser,
  resetMemoryInfluenceStore,
  listAllMemoryInfluenceStates,
} from "./persistence";

export {
  readMemoryControlConstraints,
  applyMemoryControlConstraints,
  readMemoryGovernanceConstraints,
  applyMemoryGovernanceConstraints,
} from "./bridge-settings";

export {
  processMemoryInfluenceLayer,
  applyMemoryInfluenceBehaviorWeighting,
  applyMemoryInfluenceGovernanceWeighting,
  toMemoryInfluenceLayerPayload,
  getMemoryInfluenceStateForUser,
  mergeMemoryInfluenceIntoGroundingContext,
  type ProcessMemoryInfluenceLayerParams,
} from "./apply-memory";
