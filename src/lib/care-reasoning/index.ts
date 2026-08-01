/**
 * Care Reasoning — internal reasoning layer.
 *
 * Answers the 13 core questions before caregiver response composition,
 * powered by ContinuityDecision and CareSituationUnderstanding.
 *
 * This module is NEVER exposed to the caregiver. It produces internal
 * reasoning artifacts that feed the composer.
 */

export { buildCareReasoning, assertAllQuestionsAnswered } from "./internal-reasoning-layer";
export type { CareReasoningSnapshot } from "./types";
export type {
  ReasoningWho,
  ReasoningInformationType,
  ReasoningChange,
  ReasoningPriority,
  ReasoningDeferral,
  ReasoningUnknowns,
  ReasoningQuestions,
  ReasoningEvidence,
  ReasoningRelationships,
  ReasoningMemory,
  ReasoningMonitor,
  ReasoningRevisit,
} from "./types";
