import type { SolenOSResponse } from "../response-validator";
import { hashNormalizedInput } from "./canonicalize";
import type { InterpretationStabilityResult } from "./types";

const interpretationSnapshots = new Map<string, string>();

export function fingerprintInterpretation(output: SolenOSResponse): string {
  return JSON.stringify({
    risk_level: output.risk_level,
    what_is_happening: output.what_is_happening,
    what_matters_now: output.what_matters_now,
  });
}

export function checkInterpretationStability(
  normalizedInput: string,
  output: SolenOSResponse,
): InterpretationStabilityResult {
  const key = hashNormalizedInput(normalizedInput);
  const fingerprint = fingerprintInterpretation(output);
  const previous = interpretationSnapshots.get(key);

  if (previous === undefined) {
    interpretationSnapshots.set(key, fingerprint);
    return { ok: true };
  }

  if (previous !== fingerprint) {
    return { ok: false, failure_type: "INTERPRETATION_DRIFT_DETECTED" };
  }

  return { ok: true };
}

export function clearInterpretationSnapshots(): void {
  interpretationSnapshots.clear();
}

export function peekInterpretationSnapshots(): ReadonlyMap<string, string> {
  return interpretationSnapshots;
}