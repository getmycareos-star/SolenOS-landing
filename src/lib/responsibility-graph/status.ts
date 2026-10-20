import type { ResponsibilityStatus } from "./types";

const ACTIVE_RESPONSIBILITY: ReadonlySet<ResponsibilityStatus> = new Set([
  "assigned",
  "accepted",
  "in_progress",
]);

/** Pure status helper — safe for client bundles (no node:crypto). */
export function isActiveResponsibilityStatus(
  status: ResponsibilityStatus,
): boolean {
  return ACTIVE_RESPONSIBILITY.has(status);
}
