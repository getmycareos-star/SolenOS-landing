import type {
  MissingInformationInfluenceEnvelope,
  MissingInformationQueueLayerResult,
  MissingInformationQueueState,
} from "./types";
import { getOpenMissingInformationItems } from "./influence";
import { isKnowledgeGapQuestion } from "./store";

export function runMissingInformationQueueGuarantee(params: {
  state: MissingInformationQueueState;
  envelope: MissingInformationInfluenceEnvelope;
}): MissingInformationQueueLayerResult["guarantee"] {
  const violations: string[] = [];

  for (const item of params.state.items) {
    if (!item.situationId.trim()) {
      violations.push(`item ${item.id} missing situationId — queue items must be situation-scoped`);
    }
    if (!item.question.trim()) {
      violations.push(`item ${item.id} has empty question`);
    }
    if (item.status === "open" && !isKnowledgeGapQuestion(item.question)) {
      violations.push(`item ${item.id} looks like a task, not a knowledge gap`);
    }
  }

  const open = getOpenMissingInformationItems(params.state);
  const highOpen = open.filter((i) => i.importance === "HIGH").length;
  if (params.envelope.highPriorityOpenCount !== highOpen) {
    violations.push("envelope highPriorityOpenCount mismatch with open HIGH items");
  }
  if (params.envelope.openCount !== open.length) {
    violations.push("envelope openCount mismatch with open items");
  }
  if (params.envelope.confidencePenalty > 0.45) {
    violations.push("confidence penalty exceeds cap");
  }

  return { ok: violations.length === 0, violations };
}

export function validateMissingInformationQueueLayerResult(
  layer: MissingInformationQueueLayerResult,
): MissingInformationQueueLayerResult["guarantee"] {
  return runMissingInformationQueueGuarantee({
    state: layer.state,
    envelope: layer.envelope,
  });
}
