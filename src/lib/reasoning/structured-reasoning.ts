import { validateOutput } from "../output-contract/validate";
import type { SolenOSOutput } from "../output-contract/types";

/** @deprecated Legacy reasoning path — MVP uses analyze-pipeline only. */
export function buildStructuredReasoningOutput(params: {
  whatIsHappening: string;
  mattersNow: string;
  askNext: string;
  risk: SolenOSOutput["risk_level"];
  canWait: string;
  followUp: string[];
}): SolenOSOutput {
  return validateOutput({
    what_is_happening: params.whatIsHappening,
    what_matters_now: params.mattersNow,
    what_to_ask_next: params.askNext,
    risk_level: params.risk,
    what_can_wait: params.canWait,
    follow_up_items: params.followUp.slice(0, 5),
  });
}
