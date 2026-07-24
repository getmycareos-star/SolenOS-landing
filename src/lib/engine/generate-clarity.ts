import type {
  ActionState,
  CareOutput,
  ClarityState,
  InterpretedState,
  PriorityState,
} from "./domain/types";
import { validateOutput } from "../output-contract/validate";
import { priorityToRisk } from "./prioritize";

/**
 * ACTION_STATE → CLARITY_STATE
 * Final user-facing transformation — emotional noise removed, structure enforced.
 */
export function generateClarity(
  interpreted: InterpretedState,
  priority: PriorityState,
  actions: ActionState,
): ClarityState {
  const risk = priorityToRisk(priority.classification);

  let mattersNow: string;
  switch (priority.classification) {
    case "IMMEDIATE_ACTION":
      mattersNow = actions.actions.do_now[0] ?? "Address immediate safety concerns first.";
      break;
    case "SOON_ACTION":
      mattersNow =
        actions.actions.do_today[0] ??
        "Focus on the most time-sensitive care task today.";
      break;
    case "MONITOR_ONLY":
      mattersNow =
        "Observe and document — clarify uncertain details before acting.";
      break;
    default:
      mattersNow =
        "No urgent action required — maintain awareness of the situation.";
  }

  const askNext =
    actions.actions.ask_professional[0] ??
    "What is the single most unclear part of the current care situation?";

  let canWait: string;
  if (priority.classification === "IMMEDIATE_ACTION") {
    canWait =
      "Non-urgent planning and family discussions can wait until immediate safety is addressed.";
  } else {
    canWait =
      "Long-term care planning, insurance questions, and non-urgent scheduling can wait until today's priority is clear.";
  }

  const followUp = [
    ...actions.actions.do_today.slice(0, 2),
    ...actions.actions.ask_professional.slice(0, 1),
  ].filter(Boolean);

  if (followUp.length === 0) {
    followUp.push("Document what changed today in one sentence.");
  }

  const output: CareOutput = validateOutput({
    what_is_happening: interpreted.interpretation.meaning,
    what_matters_now: mattersNow,
    what_to_ask_next: askNext,
    risk_level: risk,
    what_can_wait: canWait,
    follow_up_items: followUp.slice(0, 5),
  });

  return {
    output,
    simplified_explanation: interpreted.interpretation.meaning,
    emotional_noise_removed: true,
  };
}
