import { CONTEXT_LABELS } from "../contract-constants";
import type { BatchViewResult, CareItem, ContextType } from "../types";

function isHighRiskOutsideBatch(item: CareItem, activeContext: ContextType | null): boolean {
  if (!activeContext || item.context_type === activeContext) return false;
  return (
    item.type === "decaying" &&
    (item.decay_rate === "fast" || item.risk_level === "high")
  );
}

/**
 * Groups same-context items — alternate lens, not a competing priority system.
 */
export function buildBatchView(
  items: CareItem[],
  activeContext: ContextType | null = null,
): BatchViewResult {
  const open = items.filter((i) => i.status === "open");
  const groups: BatchViewResult["groups"] = [];

  for (const contextType of [
    "phone_call",
    "home_repair",
    "medical",
    "financial",
    "errand",
    "other",
  ] as ContextType[]) {
    const grouped = open.filter((i) => i.context_type === contextType);
    if (grouped.length === 0) continue;
    groups.push({
      context_type: contextType,
      label: CONTEXT_LABELS[contextType] ?? contextType,
      items: grouped,
    });
  }

  const outside_batch_high_risk = open.filter((i) =>
    isHighRiskOutsideBatch(i, activeContext),
  );

  return {
    view: "batch",
    groups,
    outside_batch_high_risk,
    generated_at: new Date().toISOString(),
  };
}
