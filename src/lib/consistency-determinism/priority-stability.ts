import type { SolenOSResponse } from "../response-validator";
import { hashNormalizedInput } from "./canonicalize";
import type { PriorityStabilityResult } from "./types";

const prioritySnapshots = new Map<string, string>();

export function fingerprintPriority(output: SolenOSResponse): string {
  return JSON.stringify({
    risk_level: output.risk_level,
    what_matters_now: output.what_matters_now,
    what_to_ask_next: output.what_to_ask_next,
  });
}

/** 11.3 Priority stability — same urgency ranking and what_matters_now for same input. */
export function checkPriorityStability(
  normalizedInput: string,
  output: SolenOSResponse,
): PriorityStabilityResult {
  const key = hashNormalizedInput(normalizedInput);
  const fingerprint = fingerprintPriority(output);
  const previous = prioritySnapshots.get(key);

  if (previous === undefined) {
    prioritySnapshots.set(key, fingerprint);
    return { ok: true };
  }

  if (previous !== fingerprint) {
    return { ok: false, failure_type: "PRIORITY_DRIFT_DETECTED" };
  }

  return { ok: true };
}

export function clearPrioritySnapshots(): void {
  prioritySnapshots.clear();
}

export function peekPrioritySnapshots(): ReadonlyMap<string, string> {
  return prioritySnapshots;
}

