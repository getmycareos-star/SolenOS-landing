import {
  JOURNEY_PROHIBITED,
  JOURNEY_RULES,
  SINGLE_USER_JOURNEY_DEFINING_PRINCIPLE,
} from "./contract-constants";
import type {
  JourneyStepRecord,
  ProcessSingleUserJourneyInput,
  SingleUserJourneyResult,
} from "./types";

const CHAT_PATTERNS = [
  /\bwelcome back\b/i,
  /\bhow can i help\b/i,
  /\bhi there\b/i,
  /\blet'?s chat\b/i,
  /\bi'm here for you\b/i,
];

function step(
  name: JourneyStepRecord["step"],
  completed: boolean,
  detail: string,
): JourneyStepRecord {
  return { step: name, completed, detail };
}

/**
 * Validate the Single User Journey after each situation cycle.
 * Does not replace engines — proves the continuity loop is intact.
 */
export function processSingleUserJourney(
  input: ProcessSingleUserJourneyInput,
): SingleUserJourneyResult {
  const n = input.interaction_index;
  const steps: JourneyStepRecord[] = [];

  steps.push(
    step("system_entry", input.raw_input.trim().length > 0, "User submitted input"),
  );
  steps.push(
    step(
      "input_classification",
      !input.is_session_reentry || n === 0,
      input.is_session_reentry ? "session_reentry" : "care_event_candidate",
    ),
  );
  steps.push(
    step(
      "bootstrap_care_context",
      input.care_context_exists,
      input.care_context_exists ? "CareContext present" : "CareContext missing",
    ),
  );

  if (n <= 1) {
    steps.push(
      step(
        "first_care_event_creation",
        input.events_created_count > 0 || input.total_event_count > 0,
        `${input.events_created_count} new / ${input.total_event_count} total CareEvents`,
      ),
    );
    steps.push(
      step(
        "engine_execution_first_pass",
        input.care_context_exists,
        "Deterministic pipeline executed",
      ),
    );
    steps.push(
      step(
        "first_state_of_care_output",
        input.has_state_of_care || input.final_what_is_happening.trim().length > 0,
        `mode=${input.dominant_mode}`,
      ),
    );
    steps.push(
      step(
        "first_user_value_moment",
        input.events_created_count > 0 && input.final_what_is_happening.trim().length > 0,
        "Messy input transformed into structured care understanding",
      ),
    );
  }

  if (n >= 2) {
    steps.push(
      step("return_loop_continuation_input", true, "Second (or later) care input received"),
    );
    steps.push(
      step(
        "context_retrieval",
        input.total_event_count > 0 && input.care_context_exists,
        `${input.total_event_count} events retrieved from CareContext`,
      ),
    );
    steps.push(
      step(
        "difference_computation",
        input.has_meaningful_diff || input.what_changed.length > 0,
        input.has_meaningful_diff
          ? "Meaningful CareContext diff computed"
          : `${input.what_changed.length} change line(s)`,
      ),
    );
    steps.push(
      step(
        "care_context_projection_update",
        input.care_context_exists && input.total_event_count >= 2,
        "Projection derived from Event Store / CareContext — not historical overwrite",
      ),
    );
    steps.push(
      step(
        "state_output_change_over_time",
        input.has_meaningful_diff ||
          input.what_changed.length > 0 ||
          /changed|wors|new|fell|risk/i.test(input.final_what_is_happening),
        "Output surfaces change over time",
      ),
    );
    steps.push(
      step(
        "continuity_confirmation",
        input.care_context_exists && input.total_event_count >= 2 && !input.is_session_reentry,
        "Memory persisted — CareContext did not reset",
      ),
    );
  }

  const chat_behavior_blocked = !CHAT_PATTERNS.some((p) =>
    p.test(input.final_what_is_happening),
  );

  const failure_reasons: string[] = [];
  if (!input.care_context_exists) failure_reasons.push("CareContext not persistent");
  if (n >= 2 && !(input.has_meaningful_diff || input.what_changed.length > 0)) {
    failure_reasons.push("Second input did not produce a diff");
  }
  if (!chat_behavior_blocked) failure_reasons.push("Chat-like greeting detected in output");
  if (n === 1 && input.events_created_count === 0 && input.total_event_count === 0) {
    failure_reasons.push("No CareEvent created on first input");
  }
  if (!input.final_what_is_happening.trim()) {
    failure_reasons.push("Empty state-driven output");
  }

  const continuity_proven =
    n >= 2 &&
    input.care_context_exists &&
    input.total_event_count >= 2 &&
    (input.has_meaningful_diff || input.what_changed.length > 0) &&
    chat_behavior_blocked;

  const journey_valid =
    failure_reasons.length === 0 &&
    steps.filter((s) => s.completed).length >= (n >= 2 ? 8 : 5);

  return {
    active: true,
    interaction_index: n,
    steps_completed: steps,
    continuity_proven,
    care_context_persistent: input.care_context_exists,
    care_events_created_total: input.total_event_count,
    has_state_output: input.has_state_of_care || input.final_what_is_happening.length > 0,
    has_diff_output: input.has_meaningful_diff || input.what_changed.length > 0,
    chat_behavior_blocked,
    failure_reasons,
    journey_valid,
    rules_upheld: [...JOURNEY_RULES],
    defining_principle: SINGLE_USER_JOURNEY_DEFINING_PRINCIPLE,
  };
}

export function assertNoChatOutput(text: string): boolean {
  return !CHAT_PATTERNS.some((p) => p.test(text));
}

export { JOURNEY_PROHIBITED };
