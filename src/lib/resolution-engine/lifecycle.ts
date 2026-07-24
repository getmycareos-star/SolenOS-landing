import type { SituationStatus } from "./types";

/** Allowed one-way lifecycle transitions. Reverse is never automatic. */
const ALLOWED: Record<SituationStatus, readonly SituationStatus[]> = {
  ACTIVE: ["RESOLVED"],
  RESOLVED: ["ARCHIVED"],
  ARCHIVED: [],
};

export function canTransition(
  from: SituationStatus,
  to: SituationStatus,
): boolean {
  return ALLOWED[from].includes(to);
}

/**
 * Validate a proposed transition. Reverse paths are always rejected.
 * ARCHIVED → anything is rejected (create a new ACTIVE situation instead).
 */
export function validateLifecycleTransition(
  from: SituationStatus,
  to: SituationStatus,
): { ok: true } | { ok: false; violations: string[] } {
  if (from === to) {
    return { ok: false, violations: [`already ${from}`] };
  }

  if (from === "ARCHIVED") {
    return {
      ok: false,
      violations: [
        "ARCHIVED situations cannot be resurrected — create a new ACTIVE situation",
      ],
    };
  }

  if (from === "RESOLVED" && to === "ACTIVE") {
    return {
      ok: false,
      violations: [
        "RESOLVED → ACTIVE reverse transition is not allowed — create a new ACTIVE situation if relevant again",
      ],
    };
  }

  if (from === "ACTIVE" && to === "ARCHIVED") {
    return {
      ok: false,
      violations: ["ACTIVE → ARCHIVED is not allowed; must resolve first (ACTIVE → RESOLVED → ARCHIVED)"],
    };
  }

  if (!canTransition(from, to)) {
    return {
      ok: false,
      violations: [`invalid transition ${from} → ${to}`],
    };
  }

  return { ok: true };
}

/** Required flow: ACTIVE → RESOLVED → ARCHIVED. */
export const REQUIRED_STATE_FLOW = "ACTIVE → RESOLVED → ARCHIVED" as const;
