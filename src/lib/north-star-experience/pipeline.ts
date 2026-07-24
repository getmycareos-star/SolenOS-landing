import {
  DEFINING_PRINCIPLE,
  EXPERIENCE_TEST_QUESTION,
  NORTH_STAR_FEELING,
  NORTH_STAR_EXPERIENCE_IDENTITY,
} from "./contract-constants";
import { buildContinuityRecognition } from "./continuity-voice";
import { findRelatedPriorEvents, inputSignalsContinuation } from "./detect-continuity";
import { evaluateExperience } from "./evaluate-experience";
import { recordExperienceSnapshot } from "./store";
import type { NorthStarExperienceResult, ProcessNorthStarExperienceInput } from "./types";

export function processNorthStarExperience(
  input: ProcessNorthStarExperienceInput & { as_of?: string },
): NorthStarExperienceResult {
  const isReturnSession = !input.is_first_situation && input.prior_event_count > 0;

  const relatedPriorEvents = findRelatedPriorEvents({
    raw_input: input.raw_input,
    events_created: input.events_created,
    all_events: input.all_events,
    prior_event_count: input.prior_event_count,
  });

  const continuityRecognition =
    isReturnSession || inputSignalsContinuation(input.raw_input)
      ? buildContinuityRecognition({
          raw_input: input.raw_input,
          related_prior_events: relatedPriorEvents,
          all_events: input.all_events,
          as_of: input.as_of ?? new Date().toISOString(),
        })
      : null;

  const evaluated = evaluateExperience({
    ...input,
    continuity_recognition: continuityRecognition,
    related_prior_event_ids: relatedPriorEvents.map((e) => e.id),
    is_return_session: isReturnSession,
  });

  const result: NorthStarExperienceResult = {
    active: true,
    north_star_feeling: NORTH_STAR_FEELING,
    continuity_recognition: continuityRecognition,
    is_return_session: isReturnSession,
    related_prior_event_ids: relatedPriorEvents.map((e) => e.id),
    continuity_voice_enabled: continuityRecognition !== null,
    defining_principle: DEFINING_PRINCIPLE,
    experience_test_question: EXPERIENCE_TEST_QUESTION,
    ...evaluated,
  };

  recordExperienceSnapshot({
    caregiver_id: input.caregiver_id,
    experience_score: result.experience_score,
    experience_test_passed: result.experience_test_passed,
    continuity_voice_enabled: result.continuity_voice_enabled,
    captured_at: input.as_of ?? new Date().toISOString(),
  });

  return result;
}

export { NORTH_STAR_EXPERIENCE_IDENTITY, NORTH_STAR_FEELING } from "./contract-constants";
