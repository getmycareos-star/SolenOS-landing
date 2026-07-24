/**
 * Situation Relationship Engine — sole authority for same/update/related/new
 * before CareEvents land on the CareContext spine.
 */

export {
  evaluateSituationRelationship,
  findReinforcementTargetObservation,
  SITUATION_RELATIONSHIP_ENGINE_PURPOSE,
} from "./evaluate";
export type {
  SituationRelationshipDecision,
  SituationRelationshipEvaluation,
  EngineConfidence,
} from "./evaluate";
export {
  continuesUnderlyingIssue,
  answersOpenUncertaintyGap,
  looksLikeCareDecision,
  composeIdentityMismatchAsk,
} from "./signals";
