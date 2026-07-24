import {
  ENTRY_BEHAVIOR_DEFINING_PRINCIPLE,
  ENTRY_BEHAVIOR_RULES,
  INGESTION_READY_PROMPT,
} from "./contract-constants";
import { classifyEntryInput } from "./classify";
import type { EntryBehaviorResult, ProcessEntryBehaviorInput } from "./types";

export function buildEntryBehaviorLayer(input: {
  mode: EntryBehaviorResult["mode"];
  classification: ReturnType<typeof classifyEntryInput>;
  state_reconciled: boolean;
}): EntryBehaviorResult {
  return {
    active: true,
    mode: input.mode,
    input_classification: input.classification.kind,
    state_reconciled: input.state_reconciled,
    ingestion_ready_prompt:
      input.mode === "initialization" ? INGESTION_READY_PROMPT : "",
    rules_upheld: [...ENTRY_BEHAVIOR_RULES],
    defining_principle: ENTRY_BEHAVIOR_DEFINING_PRINCIPLE,
  };
}

export function classifyAndDescribe(input: ProcessEntryBehaviorInput) {
  return classifyEntryInput({
    raw_input: input.raw_input,
    has_documents: input.has_documents,
  });
}

export { INGESTION_READY_PROMPT };
