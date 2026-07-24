import {
  MISSING_INFORMATION_CONFIDENCE_PENALTY_CAP,
  MISSING_INFORMATION_UNCERTAINTY_PER_HIGH,
} from "./contract-constants";
import { formatNeedsNextPhrase } from "./resolution";
import type {
  MissingInformationHealth,
  MissingInformationInfluenceEnvelope,
  MissingInformationItem,
  MissingInformationQueueState,
} from "./types";

export function getOpenMissingInformationItems(
  state: MissingInformationQueueState,
  situationId?: string,
): MissingInformationItem[] {
  return state.items.filter(
    (i) =>
      i.status === "open" &&
      (situationId === undefined || i.situationId === situationId),
  );
}

export function collectMissingInformationHealth(
  state: MissingInformationQueueState,
  situationId?: string,
): MissingInformationHealth {
  let openItems = 0;
  let highPriorityItems = 0;
  let resolvedItems = 0;

  for (const item of state.items) {
    if (situationId !== undefined && item.situationId !== situationId) continue;
    if (item.status === "open") {
      openItems += 1;
      if (item.importance === "HIGH") highPriorityItems += 1;
    } else if (item.status === "resolved") {
      resolvedItems += 1;
    }
  }

  return { openItems, highPriorityItems, resolvedItems };
}

/**
 * Soft influence for Priority Engine — high-priority open gaps
 * lower confidence and raise uncertainty; never invent actions.
 */
export function computeMissingInformationInfluenceEnvelope(
  state: MissingInformationQueueState,
  situationId?: string,
): MissingInformationInfluenceEnvelope {
  const open = getOpenMissingInformationItems(state, situationId);
  const health = collectMissingInformationHealth(state, situationId);
  const highPriorityOpenCount = open.filter((i) => i.importance === "HIGH").length;

  const confidencePenalty = Math.min(
    MISSING_INFORMATION_CONFIDENCE_PENALTY_CAP,
    highPriorityOpenCount * 0.15 +
      open.filter((i) => i.importance === "MEDIUM").length * 0.05,
  );

  const uncertaintyBoost = Math.min(
    0.5,
    highPriorityOpenCount * MISSING_INFORMATION_UNCERTAINTY_PER_HIGH +
      open.filter((i) => i.importance === "MEDIUM").length * 0.04,
  );

  const ranked = [...open].sort((a, b) => {
    const rank = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;
    return rank[a.importance] - rank[b.importance];
  });

  const needsNext = ranked.slice(0, 5).map(formatNeedsNextPhrase);

  return {
    openCount: open.length,
    highPriorityOpenCount,
    confidencePenalty,
    uncertaintyBoost,
    needsNext,
    health,
  };
}
