import type { GroundingContextPackage } from "../telemetry-persistence/schema";
import { loadPreReasoningEvidence } from "../telemetry-persistence/grounding";
import { getTelemetryStore } from "../telemetry-persistence/server";
import { POSTGRES_PRE_REASONING_PIPELINE } from "../postgres-contract";

export { POSTGRES_PRE_REASONING_PIPELINE };

export interface PreReasoningGroundingParams {
  telemetry_user_id?: string;
  policy_categories?: readonly string[];
}

export interface PreReasoningGroundingResult {
  grounding_context: GroundingContextPackage | null;
  pipeline_steps: readonly (typeof POSTGRES_PRE_REASONING_PIPELINE)[number][];
}

/**
 * Mandatory pre-reasoning pipeline before model invocation.
 * Order: document evidence → interaction context → vector retrieval → policy facts → packaging.
 */
export async function runPreReasoningGrounding(
  params: PreReasoningGroundingParams,
): Promise<PreReasoningGroundingResult> {
  if (!params.telemetry_user_id) {
    return {
      grounding_context: null,
      pipeline_steps: POSTGRES_PRE_REASONING_PIPELINE,
    };
  }

  const store = await getTelemetryStore();
  const grounding_context = await loadPreReasoningEvidence(
    store,
    params.telemetry_user_id,
    params.policy_categories,
  );

  return {
    grounding_context,
    pipeline_steps: POSTGRES_PRE_REASONING_PIPELINE,
  };
}
