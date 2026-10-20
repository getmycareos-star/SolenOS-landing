import { tagDocumentInput } from "../document-intake";
import { stressNormalizeInput } from "../input-stress-normalizer";
import type { CareContextState } from "../post-care-insight/contract-constants";
import type { SolenOSResponse } from "../response-validator";
import type { PersistenceSignals } from "./types";

const REMEMBER_REQUEST_PATTERN =
  /\b(remember this|save this|don'?t forget|keep track|note this|save my|remember my)\b/i;

const RETURN_BEHAVIOR_PATTERN =
  /\b(what was i|continue where|pick up where|where did i leave|resume|pick up again|last time)\b/i;

function countMultiStepItems(text: string): number {
  const numbered = text.match(/^\s*\d+[.)]/gm);
  if (numbered && numbered.length >= 2) return numbered.length;
  const bullets = text.match(/^\s*[-•*]/gm);
  if (bullets && bullets.length >= 2) return bullets.length;
  const questions = text.match(/\?/g);
  if (questions && questions.length >= 2) return questions.length;
  return text.split(/\n+/).filter((line) => line.trim().length > 0).length >= 2 ? 2 : 0;
}

export interface BuildPersistenceSignalsParams {
  input: string;
  source_type: "text" | "document";
  prior_input_raw?: string;
  resume_context?: boolean;
  care_context_state: CareContextState;
  result: SolenOSResponse;
  care_graph_node_count_before: number;
  memory_node_count_before: number;
}

export function buildPersistenceSignals(
  params: BuildPersistenceSignalsParams,
): PersistenceSignals {
  const normalized = stressNormalizeInput(params.input);
  const documentIntake = tagDocumentInput(normalized);

  const multiStepFromOutput =
    countMultiStepItems(params.result.what_to_ask_next) >= 2 ||
    (countMultiStepItems(params.result.what_can_wait) >= 2 &&
      params.care_context_state === "active_care");

  const multiStepFromContext =
    Boolean(params.prior_input_raw?.trim()) ||
    params.care_context_state === "active_care" ||
    params.care_context_state === "crisis";

  return {
    care_graph_created: params.care_graph_node_count_before === 0,
    memory_node_created: params.memory_node_count_before === 0,
    multi_step_dependency_detected: multiStepFromOutput || multiStepFromContext,
    user_remember_request: REMEMBER_REQUEST_PATTERN.test(params.input),
    return_behavior_detected:
      Boolean(params.resume_context) ||
      Boolean(params.prior_input_raw?.trim()) ||
      RETURN_BEHAVIOR_PATTERN.test(params.input),
    document_uploaded: params.source_type === "document" || documentIntake.is_document_input,
    care_decision_generated: true,
  };
}

export function activePersistenceTriggers(
  signals: PersistenceSignals,
): (keyof PersistenceSignals)[] {
  const triggers: (keyof PersistenceSignals)[] = [];
  if (signals.care_graph_created) triggers.push("care_graph_created");
  if (signals.memory_node_created) triggers.push("memory_node_created");
  if (signals.multi_step_dependency_detected) triggers.push("multi_step_dependency_detected");
  if (signals.user_remember_request) triggers.push("user_remember_request");
  if (signals.return_behavior_detected) triggers.push("return_behavior_detected");
  if (signals.document_uploaded) triggers.push("document_uploaded");
  return triggers;
}
