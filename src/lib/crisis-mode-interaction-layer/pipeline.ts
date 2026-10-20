import {
  CRISIS_BEHAVIOR_RULES,
  CRISIS_MODE_DEFINING_PRINCIPLE,
  CRISIS_MODE_IDENTITY,
  CRISIS_SUPPRESSED_ENGINES,
} from "./contract-constants";
import { buildCrisisOutput } from "./build-crisis-output";
import {
  isImmediateDangerLanguage,
  isRetrospectiveCareReport,
} from "../mvp-input-architecture";
import { crisisModeActive, detectCrisisTriggers, resolveUiMode } from "./detect-triggers";
import type { CrisisModeInteractionResult, ProcessCrisisModeInput } from "./types";

const ENGINES_ALLOWED = [
  "care_event_engine",
  "prioritization_engine",
  "minimal_explainability_engine",
  "critical_evidence_retrieval",
] as const;

export function processCrisisModeInteraction(
  input: ProcessCrisisModeInput,
): CrisisModeInteractionResult {
  const asOf = input.as_of ?? new Date().toISOString();
  const { reasons, urgency_level } = detectCrisisTriggers({
    caregiver_id: input.caregiver_id,
    raw_input: input.raw_input,
    events_created: input.events_created,
    all_events: input.all_events,
    behavior: input.behavior,
    as_of: asOf,
  });

  let crisis_mode = crisisModeActive(urgency_level, reasons.length);

  // Past / already-handled care reports are continuity capture — not live crisis triage.
  if (
    crisis_mode &&
    isRetrospectiveCareReport(input.raw_input) &&
    !isImmediateDangerLanguage(input.raw_input)
  ) {
    crisis_mode = false;
  }

  const ui_mode = crisis_mode ? resolveUiMode(urgency_level) : "full";

  const crisis_output = crisis_mode
    ? buildCrisisOutput({
        events_created: input.events_created,
        behavior: input.behavior,
        trigger_reasons: reasons,
        urgency_level,
        attention_event_ids: input.attention_event_ids,
      })
    : null;

  return {
    // active tracks live crisis triage only — lexical fall/help in continuity stays inactive
    active: crisis_mode,
    crisis_mode,
    urgency_level: crisis_mode ? urgency_level : "low",
    ui_mode,
    trigger_reasons: crisis_mode ? reasons : [],
    crisis_output,
    suppressed_engines: crisis_mode ? [...CRISIS_SUPPRESSED_ENGINES] : [],
    engines_allowed: [...ENGINES_ALLOWED],
    rules_upheld: [...CRISIS_BEHAVIOR_RULES],
    defining_principle: CRISIS_MODE_DEFINING_PRINCIPLE,
  };
}

export { CRISIS_MODE_IDENTITY };
