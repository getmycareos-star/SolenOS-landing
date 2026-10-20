/**
 * Time model beyond clocks — circadian, seasonal, life-stage, decision windows.
 */

export { TIME_MODEL_VERSION } from "./types";
export { TIME_MODEL_IDENTITY } from "./contract-constants";
export type {
  CareEventTimeCorrection,
  CircadianPattern,
  DualTimelineView,
  EventTime,
  ParseEventTimeResult,
  RetimingReason,
  SeasonalPattern,
  LifeStage,
  DecisionWindow,
  TimeModel,
} from "./types";
export { createEmptyTimeModel, summarizeTimeModel } from "./types";
export {
  getTimeModel,
  saveTimeModel,
  getOrCreateTimeModel,
  resetTimeModelStore,
} from "./store";
// Event-time parsing and ordering are part of the time model and are imported from
// this barrel by the care event and situation entry modules.
export {
  createExactEventTime,
  createIngestionTime,
  formatEventTimeLabel,
  parseEventTimeFromText,
  temporalSortKey,
} from "./parse-event-time";
export {
  buildDualTimelineView,
  isWithinEventTimeWindow,
  sortByIngestionOrder,
  sortByTemporalOrder,
  windowAnchorTime,
} from "./ordering";
export type { TimedEvent } from "./ordering";
export {
  applyEventTimeCorrection,
  applyRetrospectiveUpdate,
  createRetimingCorrectionId,
  getTimeCorrectionsForEvent,
  resetTimeCorrectionStore,
} from "./retiming";
export { resolveLateArrival } from "./late-arrival";
