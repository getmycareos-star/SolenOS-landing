import {
  BASELINE_INTELLIGENCE_DEFINING_PRINCIPLE,
  BASELINE_INTELLIGENCE_IDENTITY,
  BASELINE_INTELLIGENCE_RULES,
} from "./contract-constants";
import { deriveBaselineFacts, detectDeviations } from "./derive-baseline";
import type { BaselineIntelligenceResult, ProcessBaselineIntelligenceInput } from "./types";

export function processBaselineIntelligence(
  input: ProcessBaselineIntelligenceInput,
): BaselineIntelligenceResult {
  const createdIds = new Set(input.events_created.map((e) => e.id));
  const priorEvents = input.all_events.filter((e) => !createdIds.has(e.id));

  const baseline_facts = deriveBaselineFacts(priorEvents);
  const deviations = detectDeviations({
    baseline_facts,
    events_created: input.events_created,
    all_events: input.all_events,
  });

  const hasSignal =
    baseline_facts.length > 0 ||
    deviations.length > 0 ||
    input.raw_input.trim().length > 0;

  return {
    active: hasSignal,
    baseline_established: baseline_facts.length > 0,
    baseline_facts,
    deviations,
    comparison_question: BASELINE_INTELLIGENCE_IDENTITY,
    rules_upheld: [...BASELINE_INTELLIGENCE_RULES],
    defining_principle: BASELINE_INTELLIGENCE_DEFINING_PRINCIPLE,
  };
}

export { BASELINE_INTELLIGENCE_IDENTITY, BASELINE_PROHIBITED } from "./contract-constants";
