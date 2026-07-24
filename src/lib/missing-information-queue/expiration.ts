import type { MissingInformationItem, MissingInformationQueueState } from "./types";
import { transitionMissingInformationStatus } from "./lifecycle";

function parseIsoMs(iso: string | undefined, fallbackMs: number): number {
  if (!iso) return fallbackMs;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : fallbackMs;
}

export function isMissingInformationExpired(
  item: MissingInformationItem,
  policy: MissingInformationQueueState["policy"],
  nowMs: number,
): boolean {
  if (item.status !== "open") return item.status === "expired";
  const ageDays =
    (nowMs - parseIsoMs(item.createdAt, nowMs)) / (24 * 60 * 60 * 1000);
  return ageDays >= policy.expirationDays;
}

/**
 * Open gaps past expirationDays become expired (optional lifecycle).
 */
export function applyMissingInformationExpiration(
  state: MissingInformationQueueState,
  nowMs: number = Date.now(),
): { state: MissingInformationQueueState; expiredIds: string[] } {
  const nowIso = new Date(nowMs).toISOString();
  const expiredIds: string[] = [];
  const items = state.items.map((item) => {
    if (item.status !== "open") return item;
    if (!isMissingInformationExpired(item, state.policy, nowMs)) return item;
    expiredIds.push(item.id);
    return transitionMissingInformationStatus(item, "expired", nowIso);
  });
  return { state: { ...state, items }, expiredIds };
}
