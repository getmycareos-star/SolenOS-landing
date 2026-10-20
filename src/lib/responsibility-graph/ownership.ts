import type { Demand } from "../demand-engine/types";
import { HIGH_PRESSURE_THRESHOLD } from "../demand-engine/contract-constants";
import { HIGH_PRESSURE_RESPONSIBILITY_THRESHOLD } from "./contract-constants";
import { isActiveResponsibilityStatus } from "./status";
import type {
  DemandOwnershipEval,
  Person,
  Responsibility,
} from "./types";

export { isActiveResponsibilityStatus } from "./status";

function stableHexDigest(input: string, length = 16): string {
  // FNV-1a 64-bit — deterministic IDs without node:crypto (client + server safe).
  let h = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let i = 0; i < input.length; i++) {
    h ^= BigInt(input.charCodeAt(i));
    h = BigInt.asUintN(64, h * prime);
  }
  return h.toString(16).padStart(16, "0").slice(0, length);
}

export function stableResponsibilityId(
  demandId: string,
  ownerId: string,
): string {
  return `rsp_${stableHexDigest(`${demandId}::${ownerId}`)}`;
}

const BLOCKER_PATTERN =
  /\b(missing|waiting (on|for)|cannot proceed|blocked|need(s)? (the )?denial letter|no denial letter|awaiting)\b/i;

export function detectBlockedReason(
  demand: Demand,
  input?: string,
): string | undefined {
  const hay = `${demand.title} ${demand.description} ${input ?? ""}`;
  if (!BLOCKER_PATTERN.test(hay)) return undefined;
  if (/\bdenial letter\b/i.test(hay)) {
    return "Owner exists but cannot proceed — missing denial letter";
  }
  if (/\bmissing\b/i.test(hay) || /\bawaiting\b/i.test(hay) || /\bwaiting\b/i.test(hay)) {
    return "Owner exists but cannot proceed — missing prerequisite information";
  }
  if (/\bblocked\b/i.test(hay) || /\bcannot proceed\b/i.test(hay)) {
    return "Owner exists but cannot proceed — blocked";
  }
  return "Owner exists but cannot proceed";
}

/**
 * Evaluate ownership state for every active demand.
 * Unassigned is DANGEROUS; high-pressure unassigned → critical escalate.
 */
export function evaluateDemandOwnership(params: {
  demands: readonly Demand[];
  responsibilities: readonly Responsibility[];
  persons: readonly Person[];
  input?: string;
  highPressureThreshold?: number;
}): DemandOwnershipEval[] {
  const threshold =
    params.highPressureThreshold ??
    HIGH_PRESSURE_RESPONSIBILITY_THRESHOLD ??
    HIGH_PRESSURE_THRESHOLD;
  const personName = new Map(params.persons.map((p) => [p.id, p.name]));

  return params.demands.map((demand) => {
    const owners = params.responsibilities.filter(
      (r) =>
        r.demandId === demand.id && isActiveResponsibilityStatus(r.status),
    );
    const ownerIds = [...new Set(owners.map((o) => o.ownerId))];
    const ownerNames = ownerIds.map((id) => personName.get(id) ?? id);
    const pressureScore = demand.pressureScore;
    const highPressure = pressureScore >= threshold;
    const blockedReason =
      ownerIds.length > 0 ? detectBlockedReason(demand, params.input) : undefined;

    let ownershipState: DemandOwnershipEval["ownershipState"];
    if (ownerIds.length === 0) {
      ownershipState = "unassigned";
    } else if (blockedReason) {
      ownershipState = "blocked";
    } else if (ownerIds.length > 1) {
      ownershipState = "shared";
    } else {
      ownershipState = "assigned";
    }

    const criticalUnassigned = ownershipState === "unassigned" && highPressure;

    return {
      demandId: demand.id,
      situationId: demand.situationId,
      ownershipState,
      ownerIds,
      ownerNames,
      pressureScore,
      highPressure,
      blockedReason,
      criticalUnassigned,
    };
  });
}

/** Merge responsibility edges without inventing silent ownership transfers. */
export function upsertResponsibility(
  list: Responsibility[],
  next: Responsibility,
): Responsibility[] {
  const idx = list.findIndex((r) => r.id === next.id);
  if (idx === -1) return [...list, next];
  const existing = list[idx]!;
  // Preserve completed/failed history unless explicitly advanced.
  if (
    (existing.status === "completed" || existing.status === "failed") &&
    isActiveResponsibilityStatus(next.status)
  ) {
    return list;
  }
  const copy = [...list];
  copy[idx] = {
    ...existing,
    ...next,
    assignedAt: existing.assignedAt,
  };
  return copy;
}
