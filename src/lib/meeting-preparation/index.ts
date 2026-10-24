export {
  MEETING_PREPARATION_IDENTITY,
  MEETING_PREPARATION_BOUNDARY,
  MEETING_TYPES,
  MEETING_STATUSES,
  MEETING_SOURCES,
  PREPARATION_WINDOWS_HOURS,
  MONITORING_KEYWORDS,
  PROPOSED_MEETING_PATTERNS,
} from "./contract-constants";

export type {
  MeetingType,
  MeetingStatus,
  MeetingSource,
  PreparationPack,
  MeetingOutcome,
  CaregivingMeeting,
  CreateMeetingInput,
  ProposedMeetingInput,
  CompleteMeetingInput,
  MeetingPreparationLayerPayload,
} from "./types";

export {
  classifyMeetingType,
  MEETING_TYPE_LABELS,
} from "./classify-meeting-type";

export {
  preparationWindowHours,
  isWithinPreparationWindow,
  detectProposedMeetingsFromText,
} from "./preparation-windows";

/**
 * Stateful meeting storage and preparation are not wired to durable persistence.
 * They are intentionally excluded from this production-safe barrel; use the
 * authoritative backend appointment APIs until a durable meeting adapter exists.
 */

export { toMeetingPreparationLayerPayload } from "./layer-payload";
