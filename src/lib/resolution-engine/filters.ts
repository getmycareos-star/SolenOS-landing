import type { TrackedSituation } from "./types";

/** Situations that still require attention — sole input to Priority Engine ranking. */
export function getActiveSituations(
  situations: readonly TrackedSituation[],
): TrackedSituation[] {
  return situations.filter((s) => s.status === "ACTIVE");
}

/** RESOLVED — visible historically; excluded from priority / risk / next-action. */
export function getResolvedSituations(
  situations: readonly TrackedSituation[],
): TrackedSituation[] {
  return situations.filter((s) => s.status === "RESOLVED");
}

/** ARCHIVED — historical only; excluded from all operational engines. */
export function getArchivedSituations(
  situations: readonly TrackedSituation[],
): TrackedSituation[] {
  return situations.filter((s) => s.status === "ARCHIVED");
}

/**
 * Filter for Priority Engine — ONLY ACTIVE participate.
 * RESOLVED and ARCHIVED must not affect ranking.
 */
export function filterSituationsForPriority(
  situations: readonly TrackedSituation[],
): TrackedSituation[] {
  return getActiveSituations(situations);
}

/**
 * Filter for Risk Engine / risk consumers — ONLY ACTIVE contribute risk.
 * RESOLVED and ARCHIVED must not contribute active risk.
 */
export function filterSituationsForRisk(
  situations: readonly TrackedSituation[],
): TrackedSituation[] {
  return getActiveSituations(situations);
}

/** Whether any situation is operationally active. */
export function hasActiveSituations(situations: readonly TrackedSituation[]): boolean {
  return situations.some((s) => s.status === "ACTIVE");
}

/**
 * Count by lifecycle — system guarantee visibility.
 */
export function countByStatus(situations: readonly TrackedSituation[]): {
  active: number;
  resolved: number;
  archived: number;
  total: number;
} {
  let active = 0;
  let resolved = 0;
  let archived = 0;
  for (const s of situations) {
    if (s.status === "ACTIVE") active += 1;
    else if (s.status === "RESOLVED") resolved += 1;
    else if (s.status === "ARCHIVED") archived += 1;
  }
  return { active, resolved, archived, total: situations.length };
}
