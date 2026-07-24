import { createHash } from "node:crypto";
import type { SolenOSResponse } from "../response-validator";
import { SOLENOS_FIELD_ORDER } from "./types";

export function hashNormalizedInput(input: string): string {
  return createHash("sha256").update(input.trim()).digest("hex");
}

/** Stable serialization for cross-run comparison — fixed key order, 5 fields only. */
export function canonicalizeOutput(output: SolenOSResponse): string {
  const ordered = {
    what_is_happening: output.what_is_happening,
    what_matters_now: output.what_matters_now,
    what_to_ask_next: output.what_to_ask_next,
    risk_level: output.risk_level,
    what_can_wait: output.what_can_wait,
  };

  return JSON.stringify(ordered);
}

export function outputsAreIdentical(a: SolenOSResponse, b: SolenOSResponse): boolean {
  return canonicalizeOutput(a) === canonicalizeOutput(b);
}

function keysMatchOrder(value: Record<string, unknown>, order: readonly string[]): boolean {
  const keys = Object.keys(value);
  if (keys.length !== order.length) return false;
  return keys.every((key, index) => key === order[index]);
}

export function verifyRawFieldOrdering(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  return keysMatchOrder(raw as Record<string, unknown>, SOLENOS_FIELD_ORDER);
}

/** @deprecated _meta removed from schema */
export function canonicalizeMeta(): never {
  throw new Error("_meta removed from SolenOS schema");
}

/** @deprecated */
export const canonicalizeDecisionTrace = canonicalizeMeta;
