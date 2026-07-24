import {
  RETENTION_ENGINE_DEFINING_PRINCIPLE,
  RETENTION_ENGINE_IDENTITY,
  RETENTION_RULES,
} from "./contract-constants";
import { computeReturnStateOfCare } from "./compute-return-state";
import { recordSessionVisit } from "./session-store";
import type { ProcessRetentionEngineInput, RetentionEngineResult } from "./types";
import type { FinalOutputContract } from "../final-output-contract/types";
import { validateFinalOutput } from "../final-output-contract/schema";
import type { ReturnStateOfCare } from "./types";

export function processRetentionEngine(input: ProcessRetentionEngineInput): RetentionEngineResult {
  const return_state = computeReturnStateOfCare(input);

  return {
    active: true,
    return_state,
    session_recorded: false,
    rules_upheld: [...RETENTION_RULES],
    defining_principle: RETENTION_ENGINE_DEFINING_PRINCIPLE,
  };
}

export function compileFromReturnStateOfCare(
  returnState: ReturnStateOfCare,
  trustLayer: FinalOutputContract["trust_layer"],
  confidenceState: FinalOutputContract["confidence_state"],
  transparencyPanel: FinalOutputContract["transparency_panel"],
): FinalOutputContract {
  const { sections } = returnState;

  return validateFinalOutput({
    what_is_happening: sections.what_changed_since_last_visit.join(" · ") || returnState.headline,
    what_matters_now:
      sections.what_needs_action_now[0] ??
      sections.what_got_worse[0] ??
      "Review return delta below",
    what_to_ask_next: sections.what_needs_action_now.slice(1).join(" ") || "Continue monitoring",
    risk_level: sections.what_got_worse.length > 0 ? "medium" : "low",
    what_can_wait: sections.what_is_stable.join(" · "),
    follow_up_items: sections.what_needs_action_now,
    decision_trace: {
      events: sections.what_changed_since_last_visit,
      assumptions: [],
      unknowns:
        sections.what_got_worse.length > 0
          ? ["Deterioration signals detected since last visit"]
          : [],
      evidence_sources: ["return_value_loop", "care_context_delta"],
    },
    confidence_state: confidenceState,
    trust_layer: trustLayer,
    transparency_panel: transparencyPanel,
  });
}

export { RETENTION_ENGINE_IDENTITY, recordSessionVisit };
