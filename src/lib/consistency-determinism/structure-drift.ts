import type { SolenOSResponse } from "../response-validator";
import { verifyRawFieldOrdering } from "./canonicalize";
import { SOLENOS_FIELD_ORDER, META_FIELD_ORDER, type StructureDriftResult } from "./types";

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === allowed.length && keys.every((key) => allowed.includes(key));
}

/** Structure drift check — exactly 6 fields, fixed order, no extras. */
export function verifyStructureDrift(
  rawParsed: unknown,
  validated: SolenOSResponse,
): StructureDriftResult {
  if (!rawParsed || typeof rawParsed !== "object") {
    return {
      ok: false,
      failure_type: "STRUCTURE_DRIFT_DETECTED",
      reason: "output must be an object",
    };
  }

  const raw = rawParsed as Record<string, unknown>;

  if (!hasOnlyKeys(raw, SOLENOS_FIELD_ORDER)) {
    return {
      ok: false,
      failure_type: "STRUCTURE_DRIFT_DETECTED",
      reason: "top-level field set or count mismatch — strict 6-field schema only",
    };
  }

  if (!verifyRawFieldOrdering(raw)) {
    return {
      ok: false,
      failure_type: "STRUCTURE_DRIFT_DETECTED",
      reason: "immutable field ordering violated",
    };
  }

  if (validated.risk_level !== raw.risk_level) {
    return {
      ok: false,
      failure_type: "STRUCTURE_DRIFT_DETECTED",
      reason: "risk_level field unstable after validation",
    };
  }

  return { ok: true };
}

/** @deprecated Use verifyStructureDrift */
export const verifyOutputStability = verifyStructureDrift;