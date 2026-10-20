import { classifyItem } from "../../prioritization-engine/classify-item";
import { extractPrioritizationItems } from "../../prioritization-engine/extract-items";
import type { PrioritizedItem } from "../../prioritization-engine/types";

import { classifyContextType, classifyEffortScore } from "../classify-context";
import type { CareItem, ItemSubject } from "../types";

export function prioritizedToCareItem(
  item: PrioritizedItem,
  subject: ItemSubject,
): CareItem {
  return {
    ...item,
    context_type: classifyContextType(item.description),
    subject,
    status: "open",
    resolved_at: null,
    effort_score: classifyEffortScore(item.description, classifyContextType(item.description)),
  };
}

export function buildCareItemsFromInput(
  input: string,
  subject: ItemSubject,
  now = new Date(),
): CareItem[] {
  const rawItems = extractPrioritizationItems(input);
  const ctx = { now, fullInput: input, deprioritizedCounts: {} };
  return rawItems.map((raw) => {
    const classified = classifyItem(raw, ctx);
    return prioritizedToCareItem(classified, subject);
  });
}

export function buildCareItemsFromDescriptions(
  descriptions: string[],
  subject: ItemSubject,
  now = new Date(),
): CareItem[] {
  return descriptions.map((description, index) => {
    const classified = classifyItem(
      { id: `item-${subject}-${index}`, description },
      { now, fullInput: description, deprioritizedCounts: {} },
    );
    return prioritizedToCareItem(classified, subject);
  });
}

export function mergeOpenItems(existing: CareItem[], incoming: CareItem[]): CareItem[] {
  const byDesc = new Map<string, CareItem>();
  for (const item of existing.filter((i) => i.status === "open")) {
    byDesc.set(item.description.toLowerCase(), item);
  }
  for (const item of incoming) {
    byDesc.set(item.description.toLowerCase(), item);
  }
  return [...byDesc.values()];
}

export function topPriorityItem(items: CareItem[]): CareItem | null {
  const open = items.filter((i) => i.status === "open");
  if (open.length === 0) return null;

  const score = (item: CareItem): number => {
    let s = 0;
    if (item.type === "decaying") {
      if (item.decay_rate === "fast") s += 100;
      else if (item.decay_rate === "moderate") s += 60;
      else s += 30;
    }
    if (item.risk_level === "high") s += 40;
    else if (item.risk_level === "medium") s += 20;
    return s;
  };

  return [...open].sort((a, b) => score(b) - score(a))[0] ?? null;
}
