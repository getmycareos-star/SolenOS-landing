import type { SituationStatus as UiSituationStatus } from "../ui-runtime/types";
import type { SituationStatus as LifecycleStatus } from "./types";

/**
 * Map UI operational statuses → Resolution Engine lifecycle.
 * active|blocked|waiting all require attention → ACTIVE.
 * resolved → RESOLVED. UI has no archived; consumers pass lifecycle ARCHIVED separately.
 */
export function mapUiStatusToLifecycle(status: UiSituationStatus): LifecycleStatus {
  switch (status) {
    case "resolved":
      return "RESOLVED";
    case "active":
    case "blocked":
    case "waiting":
      return "ACTIVE";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

/**
 * Map lifecycle → UI status for display.
 * ARCHIVED maps to resolved for UI queues that only know the 4-status set
 * (both are excluded from active operational queues).
 */
export function mapLifecycleToUiStatus(
  status: LifecycleStatus,
  options?: { preserveBlockedWaiting?: "blocked" | "waiting" },
): UiSituationStatus {
  switch (status) {
    case "ACTIVE":
      return options?.preserveBlockedWaiting ?? "active";
    case "RESOLVED":
    case "ARCHIVED":
      return "resolved";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

/** Whether a UI status still requires operational attention. */
export function uiStatusIsOperationallyActive(status: UiSituationStatus): boolean {
  return status === "active" || status === "blocked" || status === "waiting";
}
