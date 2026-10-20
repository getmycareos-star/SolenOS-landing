import { FINAL_OUTPUT_CONTRACT_IDENTITY } from "./contract-constants";
import { compileFromSituationResponse } from "./compile";
import { validateFinalOutput } from "./schema";
import type { FinalOutputContract } from "./types";
import {
  enforceBoundariesOnFinalOutput,
  type ArchitecturalBoundariesResult,
} from "../architectural-boundaries";
import type { SituationResponse } from "../situation-entry/types";

export { FINAL_OUTPUT_CONTRACT_IDENTITY };

export function processFinalOutput<T extends { final_output?: FinalOutputContract }>(
  situationResponse: Parameters<typeof compileFromSituationResponse>[0],
): FinalOutputContract {
  const compiled = compileFromSituationResponse(situationResponse);
  return validateFinalOutput(compiled);
}

export function enforceFinalOutputAtBoundary(
  output: FinalOutputContract,
  source?: Omit<SituationResponse, "final_output" | "architectural_boundaries_layer">,
): {
  final_output: FinalOutputContract;
  architectural_boundaries_layer: ArchitecturalBoundariesResult;
} {
  const validated = validateFinalOutput(output);
  const { output: bounded, boundaries } = enforceBoundariesOnFinalOutput(validated, {
    has_decision_trace: validated.decision_trace.events.length > 0,
    has_evidence_links: validated.decision_trace.evidence_sources.length > 0,
    has_explicit_uncertainty: validated.decision_trace.unknowns.length > 0,
    preserves_history: (source?.context.events.length ?? 0) > 0,
    confidence_proportional:
      validated.confidence_state.overall_confidence !== "high" ||
      validated.confidence_state.completeness >= 60,
  });
  return {
    final_output: validateFinalOutput(bounded),
    architectural_boundaries_layer: boundaries,
  };
}