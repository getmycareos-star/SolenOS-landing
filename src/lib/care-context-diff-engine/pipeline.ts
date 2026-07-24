import {
  CARE_CONTEXT_DIFF_DEFINING_PRINCIPLE,
  CARE_CONTEXT_DIFF_DESIGN_RULES,
} from "./contract-constants";
import {
  computeCareContextDiffSections,
  derivePrimaryChange,
  deriveTimeFrame,
  hasMeaningfulChange,
} from "./compute-diff";
import { getPriorComprehension, recordComprehension } from "./store";
import type { ProcessCareContextDiffInput, CareContextDiffResult } from "./types";

export function processCareContextDiff(
  input: ProcessCareContextDiffInput,
): CareContextDiffResult {
  const timestamp = input.as_of ?? new Date().toISOString();
  const prior = getPriorComprehension(input.context.care_recipient_id);
  const priorComprehendedAt = prior?.comprehended_at ?? input.prior_context?.updated_at ?? null;

  const sections = computeCareContextDiffSections(input, priorComprehendedAt);
  const { time_frame, relative_to } = deriveTimeFrame(priorComprehendedAt, timestamp);

  const diff = {
    timestamp,
    care_recipient_id: input.context.care_recipient_id,
    time_frame,
    relative_to,
    sections,
    primary_change: derivePrimaryChange(sections),
  };

  recordComprehension(input.context, timestamp);

  return {
    active: true,
    diff,
    has_meaningful_change: hasMeaningfulChange(sections, input.events_created.length),
    rules_upheld: [...CARE_CONTEXT_DIFF_DESIGN_RULES],
    defining_principle: CARE_CONTEXT_DIFF_DEFINING_PRINCIPLE,
  };
}
