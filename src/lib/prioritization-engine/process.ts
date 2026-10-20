import { buildPrioritizationOutput } from "./build-output";
import { classifyItems } from "./classify-item";
import { extractPrioritizationItems } from "./extract-items";
import { detectResourceTensions } from "./resource-tension";
import { detectRiskCascades } from "./risk-cascade";
import { detectSelfNeglect } from "./self-neglect";
import type {
  PrioritizationEngineLayerPayload,
  PrioritizationEngineLayerResult,
  ProcessPrioritizationEngineParams,
} from "./types";

export function processPrioritizationEngine(
  params: ProcessPrioritizationEngineParams,
): PrioritizationEngineLayerResult {
  const now = params.now ?? new Date();
  const rawItems = extractPrioritizationItems(params.input);
  const items = classifyItems(rawItems, {
    now,
    fullInput: params.input,
    deprioritizedCounts: params.deprioritizedCounts,
  });

  const resource_tension = detectResourceTensions(
    items,
    params.input,
    params.loadScores,
  );
  const risk_cascade = detectRiskCascades(items);
  const selfNeglect = detectSelfNeglect({
    input: params.input,
    recentSubmissionTexts: params.recentSubmissionTexts,
    now,
    windowDays: params.selfMentionWindowDays,
  });

  const output = buildPrioritizationOutput({
    items,
    resource_tension,
    risk_cascade,
    selfNeglect,
    fullInput: params.input,
  });

  return {
    output,
    itemCount: items.length,
    decayingCount: items.filter((i) => i.type === "decaying").length,
    staticCount: items.filter((i) => i.type === "static").length,
  };
}

export function toPrioritizationEngineLayerPayload(
  layer: PrioritizationEngineLayerResult,
): PrioritizationEngineLayerPayload {
  return layer;
}

/** Merge multi-domain prioritization into case memory snapshot when items compete. */
export function shouldOverlayDecisionSnapshot(layer: PrioritizationEngineLayerResult): boolean {
  return layer.itemCount >= 2;
}

export function overlayDecisionSnapshotFields(
  existing: {
    what_is_happening: string;
    what_matters_now: string;
    what_can_wait: string;
    follow_up_items: string[];
  },
  layer: PrioritizationEngineLayerResult,
): typeof existing {
  if (!shouldOverlayDecisionSnapshot(layer)) return existing;

  const mergedFollowUps = [
    ...layer.output.follow_up_items,
    ...existing.follow_up_items,
  ].filter((v, i, arr) => arr.indexOf(v) === i);

  return {
    what_is_happening: layer.output.what_is_happening,
    what_matters_now: layer.output.what_matters_now,
    what_can_wait: layer.output.what_can_wait,
    follow_up_items: mergedFollowUps.slice(0, 6),
  };
}
