import {
  mapLifecycleToUiStatus,
  mapUiStatusToLifecycle,
  type SituationStatus as LifecycleStatus,
  type TrackedSituation,
} from "../resolution-engine";
import type { SituationStatus as UiSituationStatus } from "../ui-runtime/types";
import { CANONICAL_PRIORITIES } from "./contract-constants";
import type { CanonicalPriority, CanonicalSituationStatus, Situation } from "./types";

/**
 * Map Resolution Engine lifecycle → canonical runtime status.
 * ACTIVE → active, RESOLVED → resolved, ARCHIVED → archived.
 */
export function mapLifecycleToCanonical(
  status: LifecycleStatus,
): CanonicalSituationStatus {
  switch (status) {
    case "ACTIVE":
      return "active";
    case "RESOLVED":
      return "resolved";
    case "ARCHIVED":
      return "archived";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function mapCanonicalToLifecycle(
  status: CanonicalSituationStatus,
): LifecycleStatus {
  switch (status) {
    case "active":
      return "ACTIVE";
    case "resolved":
      return "RESOLVED";
    case "archived":
      return "ARCHIVED";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

/**
 * UI facets blocked|waiting collapse to canonical active.
 * resolved stays resolved; archived has no UI native — map via lifecycle bridge.
 */
export function mapUiToCanonical(status: UiSituationStatus): CanonicalSituationStatus {
  const lifecycle = mapUiStatusToLifecycle(status);
  return mapLifecycleToCanonical(lifecycle);
}

export function mapCanonicalToUi(
  status: CanonicalSituationStatus,
  options?: { preserveBlockedWaiting?: "blocked" | "waiting" },
): UiSituationStatus {
  return mapLifecycleToUiStatus(mapCanonicalToLifecycle(status), options);
}

export function isOperationallyActiveCanonical(
  status: CanonicalSituationStatus,
): boolean {
  return status === "active";
}

function inferPriority(params: {
  urgencyClass?: string;
  riskLevel?: string;
}): CanonicalPriority {
  const raw = (params.urgencyClass ?? params.riskLevel ?? "MEDIUM").toUpperCase();
  if ((CANONICAL_PRIORITIES as readonly string[]).includes(raw)) {
    return raw as CanonicalPriority;
  }
  return "MEDIUM";
}

/**
 * Build canonical Situation from Resolution Engine TrackedSituation.
 * Everything in core runtime attaches to this entity.
 */
export function toCanonicalSituation(
  tracked: TrackedSituation,
  options?: {
    priority?: CanonicalPriority;
    summary?: string;
    urgencyClass?: string;
    riskLevel?: string;
  },
): Situation {
  return {
    id: tracked.id,
    status: mapLifecycleToCanonical(tracked.status),
    title: tracked.title,
    createdAt: tracked.createdAt,
    updatedAt: tracked.updatedAt,
    priority:
      options?.priority ??
      inferPriority({
        urgencyClass: options?.urgencyClass,
        riskLevel: options?.riskLevel,
      }),
    summary: options?.summary ?? tracked.title,
  };
}

export function requireSituationOrNull(
  situations: readonly Situation[],
): Situation | null {
  return situations.find((s) => s.status === "active") ?? situations[0] ?? null;
}
