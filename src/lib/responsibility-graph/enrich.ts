import type { DemandOwnershipEval, Person, Responsibility } from "./types";
import { isActiveResponsibilityStatus } from "./status";

/**
 * Format next-action language with explicit ownership.
 * "Pick up medication" → "David should pick up medication"
 */
export function formatActionWithOwner(
  ownerName: string | null | undefined,
  action: string,
): string {
  const trimmed = action.trim();
  if (!trimmed) return trimmed;
  const name = ownerName?.trim();
  if (!name) return trimmed;
  // Already owned language.
  if (new RegExp(`^${escapeRegExp(name)}\\s+should\\b`, "i").test(trimmed)) {
    return trimmed;
  }
  const body = trimmed.replace(/^[A-Z]/, (c) => c.toLowerCase());
  return `${name} should ${body}`;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Prefer highest-pressure assigned/shared/blocked demand's primary owner. */
export function selectPrimaryOwnerForSurface(params: {
  ownershipEvals: readonly DemandOwnershipEval[];
  persons: readonly Person[];
}): {
  ownerName: string | null;
  ownershipState: DemandOwnershipEval["ownershipState"] | null;
  demandId: string | null;
} {
  const ranked = [...params.ownershipEvals].sort(
    (a, b) => b.pressureScore - a.pressureScore,
  );
  const withOwner = ranked.find((e) => e.ownerNames.length > 0);
  if (withOwner) {
    return {
      ownerName: withOwner.ownerNames[0] ?? null,
      ownershipState: withOwner.ownershipState,
      demandId: withOwner.demandId,
    };
  }
  const top = ranked[0];
  return {
    ownerName: null,
    ownershipState: top?.ownershipState ?? null,
    demandId: top?.demandId ?? null,
  };
}

/** Record failed responsibilities into miss list (STATE failure tracking). */
export function collectMissedFromResponsibilities(
  responsibilities: readonly Responsibility[],
  nowIso = new Date().toISOString(),
): {
  responsibilityId: string;
  demandId: string;
  ownerId: string;
  failedAt: string;
}[] {
  return responsibilities
    .filter((r) => r.status === "failed")
    .map((r) => ({
      responsibilityId: r.id,
      demandId: r.demandId,
      ownerId: r.ownerId,
      failedAt: r.completedAt ?? nowIso,
    }));
}

export function markResponsibilityFailed(
  responsibilities: Responsibility[],
  responsibilityId: string,
  nowIso = new Date().toISOString(),
): Responsibility[] {
  return responsibilities.map((r) =>
    r.id === responsibilityId && isActiveResponsibilityStatus(r.status)
      ? { ...r, status: "failed" as const, completedAt: nowIso }
      : r,
  );
}
