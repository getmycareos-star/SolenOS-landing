import type { ProcessResult, SolenOSState } from "./types";
import { createInitialState } from "./types";
import { runPipeline } from "./pipeline";

/**
 * process(input, state) => { output, new_state }
 * Thin wrapper over deterministic pipeline.
 */
export function process(
  input: string,
  state: SolenOSState = createInitialState(),
): ProcessResult {
  const { output, new_state } = runPipeline(input, state);
  return { output, new_state };
}

export { runPipeline } from "./pipeline";
export { createInitialState } from "./types";
export type {
  SolenOSState,
  ProcessResult,
  SessionMemory,
  Classification,
  DomainTag,
} from "./types";
