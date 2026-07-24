import type { SolenOSResponse } from "../response-validator";
import { canonicalizeOutput, hashNormalizedInput } from "./canonicalize";
import type { ConsistencyCheckResult } from "./types";

const repeatedInputSnapshots = new Map<string, string>();

export function checkRepeatedInputConsistency(
  normalizedInput: string,
  output: SolenOSResponse,
): ConsistencyCheckResult {
  const key = hashNormalizedInput(normalizedInput);
  const canonical = canonicalizeOutput(output);
  const previous = repeatedInputSnapshots.get(key);

  if (previous === undefined) {
    repeatedInputSnapshots.set(key, canonical);
    return { ok: true };
  }

  if (previous !== canonical) {
    return { ok: false, failure_type: "CONSISTENCY_FAILURE" };
  }

  return { ok: true };
}

export function peekRepeatedInputSnapshots(): ReadonlyMap<string, string> {
  return repeatedInputSnapshots;
}

export function clearRepeatedInputSnapshots(): void {
  repeatedInputSnapshots.clear();
}

export function recordRepeatedInputSnapshot(
  normalizedInput: string,
  output: SolenOSResponse,
): void {
  repeatedInputSnapshots.set(hashNormalizedInput(normalizedInput), canonicalizeOutput(output));
}
