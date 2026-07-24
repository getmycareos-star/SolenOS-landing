import type { SolenOSResponse } from "../response-validator";
import { validateGuiltReplayInterruption } from "./guilt-replay";
import { validateCompressionConstraints } from "./compress-uncertainty";
import { validateActionRelevantChange } from "./action-relevant";
import { isWithinVerbosityLimit } from "./verbosity";

export type CognitiveCompressionViolationCode =
  | "guilt_narrative_validated"
  | "emotional_analysis_expanded"
  | "guilt_loop_not_interrupted"
  | "multi_path_reasoning"
  | "speculative_branching"
  | "alternative_simulation"
  | "depth_expansion"
  | "matters_lacks_change_signal"
  | "matters_background_only"
  | "matters_emotional_only"
  | "verbosity_exceeded";

export interface CognitiveCompressionResult {
  valid: boolean;
  violations: CognitiveCompressionViolationCode[];
  input_has_guilt_replay: boolean;
}

/**
 * Unified cognitive compression gate — three operations only:
 * compress uncertainty, interrupt guilt replay, surface action-relevant change.
 */
export function validateCognitiveCompression(
  output: SolenOSResponse,
  input?: string,
): CognitiveCompressionResult {
  const guilt = validateGuiltReplayInterruption(output, input);
  const compression = validateCompressionConstraints(output);
  const actionRelevant = validateActionRelevantChange(output);
  const violations = new Set<CognitiveCompressionViolationCode>();

  for (const code of guilt.violations) {
    violations.add(code);
  }
  for (const code of compression.violations) {
    violations.add(code);
  }
  for (const code of actionRelevant.violations) {
    violations.add(code);
  }

  if (!isWithinVerbosityLimit(output)) {
    violations.add("verbosity_exceeded");
  }

  return {
    valid: violations.size === 0,
    violations: [...violations],
    input_has_guilt_replay: guilt.input_has_guilt_replay,
  };
}

export function isCognitiveCompressionValid(
  output: SolenOSResponse,
  input?: string,
): boolean {
  return validateCognitiveCompression(output, input).valid;
}
