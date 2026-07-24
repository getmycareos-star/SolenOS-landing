import { CAPACITY_MATCHED_NOTE } from "../contract-constants";
import { topPriorityItem } from "../items/build-care-items";
import type { CapacityLevel, CapacityMatchedSuggestion, CareItem } from "../types";

/**
 * When capacity is low, surface smallest meaningful step alongside top priority — never replacing it.
 */
export function buildCapacityMatchedSuggestion(
  items: CareItem[],
  capacity: CapacityLevel | null,
): CapacityMatchedSuggestion | null {
  const top = topPriorityItem(items);
  if (!capacity || capacity !== "low") return null;

  const open = items.filter((i) => i.status === "open");
  const candidates = open
    .filter((i) => i.effort_score <= 2)
    .sort((a, b) => a.effort_score - b.effort_score || a.description.localeCompare(b.description));

  const smallest = candidates.find((i) => i.id !== top?.id) ?? candidates[0];
  if (!smallest) return null;

  return {
    label: "capacity_matched_suggestion",
    item: smallest,
    note: CAPACITY_MATCHED_NOTE,
    top_priority_item: top,
  };
}
