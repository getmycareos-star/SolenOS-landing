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

/** In-memory store APIs are intentionally not exported from the client-safe production barrel. */

/**
 * Client-safe barrel only.
 * Postgres / record helpers: import from `@/lib/care-journey/server`.
 */
