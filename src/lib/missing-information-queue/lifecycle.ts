import type { MissingInformationItem, MissingInformationStatus } from "./types";

const VALID_TRANSITIONS: Record<
  MissingInformationStatus,
  readonly MissingInformationStatus[]
> = {
  open: ["resolved", "expired"],
  resolved: [],
  expired: [],
};

export function canTransitionMissingInformationStatus(
  from: MissingInformationStatus,
  to: MissingInformationStatus,
): boolean {
  if (from === to) return true;
  return VALID_TRANSITIONS[from].includes(to);
}

export function transitionMissingInformationStatus(
  item: MissingInformationItem,
  to: MissingInformationStatus,
  nowIso: string,
): MissingInformationItem {
  if (!canTransitionMissingInformationStatus(item.status, to)) {
    return item;
  }
  return {
    ...item,
    status: to,
    resolvedAt: to === "resolved" || to === "expired" ? nowIso : item.resolvedAt,
  };
}

export function isOpenStatus(status: MissingInformationStatus): boolean {
  return status === "open";
}
