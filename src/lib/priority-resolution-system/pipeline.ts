import {
  OUTPUT_MODE_PRIORITY,
  PRIORITY_RESOLUTION_DEFINING_PRINCIPLE,
  PRIORITY_RESOLUTION_RULES,
} from "./contract-constants";
import type {
  OutputMode,
  PriorityResolutionResult,
  ProcessPriorityResolutionInput,
  PriorityTriggers,
} from "./types";

function evaluateMode(triggers: PriorityTriggers, mode: OutputMode): boolean {
  switch (mode) {
    case "crisis_mode":
      return triggers.crisis_detected;
    case "first_60s_value_loop":
      return triggers.no_care_context || triggers.is_first_interaction;
    case "return_value_loop":
      return (
        triggers.is_session_reentry &&
        triggers.is_return_session &&
        triggers.has_care_context &&
        !triggers.crisis_detected
      );
    case "state_of_care_summary":
      return (
        triggers.has_care_context &&
        !triggers.crisis_detected &&
        !triggers.no_care_context &&
        !(triggers.is_session_reentry && triggers.is_return_session) &&
        !(
          triggers.insufficient_data_for_inference &&
          triggers.clarification_required &&
          !triggers.has_meaningful_change &&
          !triggers.is_first_interaction
        )
      );
    case "clarification_mode":
      return (
        (triggers.clarification_required || triggers.insufficient_data_for_inference) &&
        !triggers.has_meaningful_change
      );
    default:
      return false;
  }
}

/**
 * Strict priority evaluator — first matching mode in OUTPUT_MODE_PRIORITY wins.
 * Deterministic: same triggers → same dominant mode.
 */
export function resolveDominantOutputMode(
  triggers: ProcessPriorityResolutionInput,
): PriorityResolutionResult {
  let dominant: OutputMode = "state_of_care_summary";
  let reason = "Default: State of Care Summary";

  for (const mode of OUTPUT_MODE_PRIORITY) {
    if (evaluateMode(triggers, mode)) {
      dominant = mode;
      reason = `Selected ${mode}: highest-priority active trigger`;
      break;
    }
  }

  // Clarification never wins over state summary when we have context —
  // but if ONLY clarification matches (no context path fell through), keep it.
  // evaluateMode for state_of_care already covers normal use; clarification is lowest.

  const suppressed = OUTPUT_MODE_PRIORITY.filter((m) => m !== dominant);

  return {
    active: true,
    dominant_mode: dominant,
    suppressed_modes: [...suppressed],
    evaluated_triggers: { ...triggers },
    selection_reason: reason,
    rules_upheld: [...PRIORITY_RESOLUTION_RULES],
    defining_principle: PRIORITY_RESOLUTION_DEFINING_PRINCIPLE,
  };
}

export function processPriorityResolution(
  input: ProcessPriorityResolutionInput,
): PriorityResolutionResult {
  return resolveDominantOutputMode(input);
}
