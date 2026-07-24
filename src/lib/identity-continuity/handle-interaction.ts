import type { CareContextState } from "../post-care-insight/contract-constants";
import type { SolenOSResponse } from "../response-validator";
import { evaluatePostAnalyzeContinuity } from "./evaluate-continuity";
import type { ContinuityLayerPayload, IdentityContinuityState } from "./types";

export interface HandleUserInteractionParams {
  input: string;
  source_type: "text" | "document";
  identityState: Pick<
    IdentityContinuityState,
    "care_session_id" | "user_id" | "mode" | "auth_enabled" | "has_stored_care_graph"
  >;
  prior_input_raw?: string;
  resume_context?: boolean;
  /** Pre-computed care inference result — value is always produced first. */
  careResult: SolenOSResponse;
  care_context_state: CareContextState;
  interaction_id?: string;
}

export interface HandleUserInteractionResult {
  result: SolenOSResponse;
  continuity_layer: ContinuityLayerPayload;
  care_session_id: string;
}

/**
 * Decision flow: produce value first, then evaluate persistence need.
 * Never blocks inference on auth.
 */
export function handleUserInteraction(
  params: HandleUserInteractionParams,
): HandleUserInteractionResult {
  const continuity = evaluatePostAnalyzeContinuity({
    input: params.input,
    source_type: params.source_type,
    prior_input_raw: params.prior_input_raw,
    resume_context: params.resume_context,
    care_context_state: params.care_context_state,
    result: params.careResult,
    care_session_id: params.identityState.care_session_id,
    user_id: params.identityState.user_id,
    interaction_id: params.interaction_id,
  });

  return {
    result: params.careResult,
    continuity_layer: continuity.continuity_layer,
    care_session_id: continuity.care_session_id,
  };
}

export {
  requiresPersistence,
  evaluateRequiresPersistence,
  buildPersistenceSignals,
} from "./persistence-evaluator";
export { shouldPromptSignup, shouldPromptLogin, resolveContinuityPrompt } from "./prompt-logic";
export {
  restoreCareGraph,
  hydrateMemoryState,
  resumeContinuityState,
  rebindActiveDecisions,
  rehydrateCareState,
} from "./rehydration";
export { upgradeEphemeralToPersistent, authenticatePersistentUser } from "./state-upgrade";
export { evaluatePostAnalyzeContinuity } from "./evaluate-continuity";
