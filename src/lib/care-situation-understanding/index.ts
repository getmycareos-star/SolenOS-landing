/**
 * Care Situation Understanding — public API.
 * SoT plan: Care Understanding Engine (instant value on first capture).
 */

export {
  CARE_SITUATION_UNDERSTANDING_PURPOSE,
  INSTANT_VALUE_RULE,
  type CareSituationUnderstanding,
  type CareSituationFact,
  type CareSituationInterpretation,
  type CareSituationPossibleLink,
  type CareSituationFactKind,
} from "./types";

export {
  buildCareSituationUnderstanding,
  buildCareSituationUnderstandingFromExtraction,
} from "./build";
export { prioritizeCareSituation, looksLikeFragmentationOrAdmin } from "./prioritize";
export {
  projectCareSituationOrientation,
  type CareSituationOrientationProjection,
} from "./project";
export {
  acceptCareSituationUnderstanding,
  type UnderstandingAcceptanceResult,
  type UnderstandingAcceptanceFailure,
} from "./acceptance";
export {
  llmStructuredUnderstanding,
  deterministicUnderstanding,
} from "./llm-understanding";
