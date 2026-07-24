export {
  COGNITIVE_RELIEF_IDENTITY,
  COGNITIVE_RELIEF_BOUNDARY,
  CHECKIN_CLOSING_TEMPLATE,
  RUNWAY_DISCLAIMER,
  DEFAULT_CAREGIVER_ID,
  SHARE_DEFAULT_EXCLUDED,
  SHARE_TOKEN_TTL_HOURS,
} from "./contract-constants";

export type {
  SummaryAudience,
  CheckinPeriod,
  EventLogCategory,
  KeyDate,
  CareTeamMember,
  TaggedEventLogEntry,
  LocationIndexEntry,
  CareRecipientProfileData,
  CareRecipientProfileRecord,
  PatternContext,
  IngestEntryResult,
  GeneratedSummary,
  CheckinOutput,
  SharedViewResult,
  PoolRunwayEntry,
  PoolRunwayView,
} from "./types";

export { ingestCareEntry, type IngestCareEntryParams } from "./ingest-entry";

export {
  getOrCreateProfile,
  getProfileById,
  updateProfileData,
  patchProfileRecord,
  resetCareRecipientProfileStore,
  careRecipientProfileSchema,
} from "./care-recipient-profile/store";

export { tryLoadProfile, trySaveProfile } from "./care-recipient-profile/postgres-store";

export { generateSummary } from "./modules/tell-once";
export { computePatternContext } from "./modules/pattern-recognition";
export {
  upsertLocation,
  removeLocation,
  getLocation,
  ensureDefaultLocations,
  DEFAULT_LOCATION_HINTS,
} from "./modules/location-index";
export { generateCheckin } from "./modules/close-loop";
export {
  generateSharedView,
  resolveSharedView,
  resetSharedViewStore,
  type SharedViewScope,
} from "./modules/sharing";
export { computePoolRunway } from "./modules/runway";
