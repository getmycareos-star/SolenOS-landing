import type { SolenOSResponse } from "../response-validator";
import type { StressNormalizedOutput } from "../input-stress-normalizer";
import type { EpistemicSafetyResult } from "./constants";
import { detectEpistemicViolations, detectHighSensitivityContext } from "./detect";
import { rewriteEpistemicOutput } from "./rewrite";
import { UNCERTAINTY_PRESERVATION_MARKERS } from "./constants";

function ensureHighSensitivityFraming(
  output: SolenOSResponse,
  highSensitivity: boolean,
): SolenOSResponse {
  if (!highSensitivity) return output;

  const combined = `${output.what_is_happening} ${output.what_matters_now}`;
  if (UNCERTAINTY_PRESERVATION_MARKERS.test(combined)) {
    return output;
  }

  return {
    ...output,
    what_is_happening: `${output.what_is_happening} Uncertainty remains and requires professional review in this sensitive context.`,
  };
}

export function enforceEpistemicSafety(
  output: SolenOSResponse,
  inputContext?: StressNormalizedOutput,
): EpistemicSafetyResult & { output: SolenOSResponse } {
  const high_sensitivity = detectHighSensitivityContext(inputContext);
  const initialViolations = detectEpistemicViolations(output, inputContext);

  let current = output;
  let rewritten = false;

  if (initialViolations.length > 0) {
    current = rewriteEpistemicOutput(current);
    rewritten = true;
  }

  if (high_sensitivity) {
    const reframed = ensureHighSensitivityFraming(current, true);
    if (reframed !== current) {
      current = reframed;
      rewritten = true;
    }
  }

  const remainingViolations = detectEpistemicViolations(current, inputContext);

  return {
    valid: remainingViolations.length === 0,
    violations: remainingViolations.length > 0 ? remainingViolations : initialViolations,
    rewritten,
    high_sensitivity,
    output: current,
  };
}

export function isEpistemicSafetyGateValid(
  output: SolenOSResponse,
  inputContext?: StressNormalizedOutput,
): boolean {
  return enforceEpistemicSafety(output, inputContext).valid;
}
