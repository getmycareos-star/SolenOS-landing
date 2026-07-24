/**
 * Care Reality extraction — Observation / Event / Decision / Outcome / Unknown / Relationship.
 *
 * SoT: docs/02-product/solenos-*-extraction.md
 */

export const CARE_REALITY_EXTRACTION_PURPOSE =
  "Observation → Event → Decision → Relationship → Response Contract — Unknown preserves knowledge boundaries; never invent facts, keyword-only links, or causation theater.";

export type {
  ExtractionCategory,
  ObservationConfidence,
  ExtractedObservation,
  ExtractedEvent,
  ExtractedDecision,
  ExtractedAction,
  ExtractedOutcome,
  ExtractedUnknown,
  ExtractedNonCareFact,
  RelationshipKindInternal,
  ExtractedRelationship,
  CareRealityExtractionResult,
  UnknownRelatedObjectType,
  UnknownStatus,
  OutcomeRelatedType,
  OutcomeStatus,
} from "./types";

export {
  looksLikeCareDecisionFragment,
  looksLikeContributorLoadFragment,
  looksLikeDisagreementPerspectiveFragment,
  looksLikeOpenUnknownFragment,
  classifyExtractionFragment,
} from "./classify";

export {
  DECISION_EXTRACTION_ASK,
  DECISION_EXTRACTION_NEVER_ASK,
  createExtractedDecision,
  linkDecisionEvidence,
  looksLikeRecommendationNotDecision,
  decisionWhy,
  decisionWho,
  isExtractableDecisionFragment,
} from "./decisions";

export {
  EXTRACTION_STACK_ASKS,
  EXTRACTION_STACK_PIPELINE,
  EXTRACTION_STACK_PURPOSE,
} from "./stack";
export type { ExtractionStackStage } from "./stack";

export {
  RELATIONSHIP_EXTRACTION_ASK,
  RELATIONSHIP_EXTRACTION_NEVER_ASK,
  proposeExtractionRelationships,
  composeCaregiverConnectionFromRelationships,
  containsRelationshipEnumLeakage,
  containsRelationshipCausationTheater,
  RELATIONSHIP_ENUM_LEAKAGE_PATTERNS,
  RELATIONSHIP_CAUSATION_THEATER_PATTERNS,
} from "./relationships";

export {
  extractCareRealityFromText,
  splitCompoundCareClauses,
  splitExtractionFragments,
} from "./extract";
export {
  caregiverFacingLinesFromExtraction,
  caregiverFacingLinesFromCaptureText,
  applySessionKinshipDisplay,
} from "./caregiver-surfaces";
export {
  createExtractedUnknown,
  composeCaregiverUnknownAsk,
  looksLikeInventedCertaintyFromUncertainty,
  normalizeUnknownQuestion,
  dedupeExtractedUnknowns,
  UNKNOWN_EXTRACTION_ASK,
  UNKNOWN_EXTRACTION_NEVER_ASK,
  UNKNOWN_EXTRACTION_CORE,
  containsUnknownStatusLeakage,
  validateUnknownPreservation,
  assertUnknownPreservation,
  UNKNOWN_STATUS_LEAKAGE_PATTERNS,
} from "./unknowns";
export {
  createExtractedOutcome,
  composeCaregiverOutcomeLine,
  looksLikeOutcomeFragment,
  looksLikeIntentionNotOutcome,
  looksLikeInterpretationWithoutEvidence,
  normalizeOutcomeDescription,
} from "./outcomes";
export {
  createExtractedEvent,
  normalizeEventDescription,
  extractEventParticipants,
  looksLikeIntentionNotEvent,
  looksLikeCareJourneyEventFragment,
} from "./events";

export {
  ACTION_EXTRACTION_ASK,
  ACTION_EXTRACTION_NEVER_ASK,
  looksLikeCareActionFragment,
  createExtractedAction,
  actionWho,
  isActionNotOutcome,
} from "./actions";

import {
  looksLikeContributorLoadFragment,
  looksLikeDisagreementPerspectiveFragment,
} from "./classify";

/** True when a line must not drive standout / What matters (load or disagreement). */
export function isNonObservationFocusLine(text: string): boolean {
  return (
    looksLikeContributorLoadFragment(text) ||
    looksLikeDisagreementPerspectiveFragment(text)
  );
}
