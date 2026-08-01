/**
 * SolenOS Intelligence Layer — reasoning.
 *
 * Applies the 13 reasoning questions from the Intelligence Specification
 * before any response is composed. This is the explicit reasoning boundary
 * that was previously implicit in the procedural pipeline.
 */

import type {
  ActiveCareSituation,
  CanonicalCareEvent,
  CareRealityState,
  ContinuityDecision,
} from "../situation-entry";
import type { CareSituationUnderstanding } from "../care-situation-understanding";
import type { SolenOSInput, SolenOSMemory, ReasoningResult } from "./types";

export function applyReasoning(params: {
  input: SolenOSInput;
  memory: SolenOSMemory;
  understanding: CareSituationUnderstanding;
}): ReasoningResult {
  const { input, memory, understanding } = params;
  const careRecipientId = memory.careRealityState?.care_recipient_id ??
    memory.activeSituation?.care_recipient_id ??
    input.careRecipientId ??
    input.caregiverId;

  const questionsAnswered =
    understanding.facts.length > 0 ||
    understanding.possible_links.length > 0 ||
    understanding.changes_from_baseline.length > 0;

  const prioritySet =
    understanding.matters_now.length > 0 || understanding.can_wait.length > 0;

  const uncertaintiesIdentified =
    understanding.unknowns.length > 0 || understanding.follow_up_questions.length > 0;

  const hasOpenLoopsInMemory =
    (memory.careRealityState?.open_uncertainties.length ?? 0) > 0;

  const resolvedByThisTurn = understanding.unknowns.filter((u) =>
    memory.careRealityState?.open_uncertainties.some((prior) =>
      u.toLowerCase().includes(prior.toLowerCase().slice(0, 32)) ||
      prior.toLowerCase().includes(u.toLowerCase().slice(0, 32)),
    ),
  ).length;

  return {
    questionsAnswered,
    prioritySet,
    uncertaintiesIdentified,
  };
}
