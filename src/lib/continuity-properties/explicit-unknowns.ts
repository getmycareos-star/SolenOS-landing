/**
 * Back-compat re-export — Unknowns Engine lives in src/lib/unknowns-engine.
 * Dementia is a profile there, not architecture here.
 */
export {
  UNKNOWN_PRIORITIES,
  deriveExplicitUnknowns,
  clarificationTargetsFromUnknowns,
  questionsFromUnknowns,
} from "../unknowns-engine";
export type {
  ExplicitUnknown,
  ExplicitUnknownsProjection,
  UnknownPriority,
} from "../unknowns-engine";
