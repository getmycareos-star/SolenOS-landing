import {
  assembleDecisionSnapshot,
} from "./assemble-decision-snapshot";
import { extractFacts } from "./extract-facts";
import { identifyCase } from "./identify-case";
import { applyPatternResponsePolicy } from "./pattern-response-policy";
import { rankRelevantEvents } from "./rank-relevant-events";
import { runCaseMemoryGuarantee } from "./guarantee";
import { listEventsForCase } from "./stores/event-timeline-store";
import { updateCaseFromFacts } from "./update-case";
import type {
  CaseMemoryLayerPayload,
  CaseMemoryLayerResult,
} from "./types";

export type ProcessCaseMemoryLayerParams = {
  input: string;
  preferredCaseId?: string;
  situationId?: string;
  source?: string;
  now?: string;
};

/**
 * Case Memory pipeline step:
 * Identify Case → Extract Facts → Update Case/Timeline → Selective Recall → PRP → Decision Snapshot
 */
export function processCaseMemoryLayer(
  params: ProcessCaseMemoryLayerParams,
): CaseMemoryLayerResult {
  const identified = identifyCase(params.input, params.preferredCaseId);
  const facts = extractFacts(params.input);
  const updated = updateCaseFromFacts(identified.caseEntity, facts, {
    source: params.source ?? "caregiver_input",
    now: params.now,
    situationId: params.situationId,
  });

  const excludeEventIds = new Set(updated.newEvents.map((e) => e.id));
  const timeline = listEventsForCase(updated.caseEntity.id);
  const recall = rankRelevantEvents({
    facts,
    timeline,
    excludeEventIds,
    now: params.now ? new Date(params.now) : new Date(),
    caseId: updated.caseEntity.id,
  });
  const policy = applyPatternResponsePolicy({
    caseEntity: updated.caseEntity,
    facts,
    recall,
  });
  const snapshot = assembleDecisionSnapshot({
    caseEntity: updated.caseEntity,
    facts,
    policy,
    rawInput: params.input,
  });

  const partial: CaseMemoryLayerResult = {
    caseEntity: updated.caseEntity,
    identified: identified.identified,
    extracted: facts,
    newEvents: updated.newEvents,
    recall,
    policy,
    snapshot,
    guarantee: { ok: true, violations: [] },
  };
  const guarantee = runCaseMemoryGuarantee(partial);

  return { ...partial, guarantee };
}

export function toCaseMemoryLayerPayload(
  layer: CaseMemoryLayerResult,
): CaseMemoryLayerPayload {
  return {
    caseId: layer.caseEntity.id,
    displayName: layer.caseEntity.profile.displayName,
    relationship: layer.caseEntity.profile.relationship,
    status: layer.caseEntity.status,
    patternState: layer.policy.state,
    matchStrength: layer.policy.matchStrength,
    shouldRecall: layer.recall.shouldRecall,
    recalledEventCount: layer.recall.ranked.length,
    conditionCount: layer.caseEntity.conditions.length,
    timelineEventCount: listEventsForCase(layer.caseEntity.id).length,
    preferredInterventionLabel: layer.policy.preferredIntervention?.label,
    decision_snapshot: layer.snapshot,
  };
}
