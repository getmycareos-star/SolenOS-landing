export {
  NORMALIZER_IDENTITY,
  CONFIDENCE_AUTO_COMMIT,
  CONFIDENCE_NEEDS_REVIEW,
  ATOMIC_EVENT_TYPES,
  DEDUP_TIME_WINDOW_MS,
} from "./contract-constants";

export type {
  AtomicEventType,
  ConfidenceTier,
  EventStatus,
  UncertaintyRecord,
  NormalizedAtomicEvent,
  NormalizationAction,
  NormalizationResult,
  PreNormalizedText,
} from "./types";

export { preNormalizeText } from "./pre-normalize";
export { splitCompositeInput, hasMultipleActions } from "./split-composite";
export { isNoiseFragment, attachNoiseToParent } from "./atomicity-rules";
export { classifyConfidenceTier, tierToStatus } from "./confidence-tiers";
export { deduplicateEvents } from "./deduplicate";
export { applyMedicationUpdateRule } from "./update-existing";
export { createUncertainty, resolveUncertainty, unresolvedFields } from "./uncertainty-lifecycle";

export {
  normalizeEvents,
  createUnprocessedEvent,
  createCorrectionEvent,
  getCommittedEvents,
  storeCommittedEvents,
  resetNormalizationStore,
  createNormalizedEventId,
} from "./event-normalizer";
