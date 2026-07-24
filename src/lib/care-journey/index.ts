export {
  CARE_JOURNEY_IDENTITY,
  CARE_JOURNEY_BOUNDARY,
  CARE_JOURNEY_CATEGORIES,
  type CareJourneyCategory,
  type CareJourneyAttachment,
  type CareJourneyEvent,
  type CreateCareJourneyEventInput,
  type CareJourneyTimelineEntry,
  type CareJourneySearchResult,
} from "./types";

export {
  inferCareJourneyCategory,
  inferCareJourneyTitle,
  CATEGORY_LABELS,
} from "./classify";

export {
  createCareJourneyEvent,
  getCareJourneyEvent,
  listCareJourneyEventsForCaregiver,
  listCareJourneyEventsForCase,
  searchCareJourneyEvents,
  resetCareJourneyStore,
  attachmentsFromDocumentRefs,
} from "./store";

/**
 * Client-safe barrel only.
 * Postgres / record helpers: import from `@/lib/care-journey/server`.
 */
