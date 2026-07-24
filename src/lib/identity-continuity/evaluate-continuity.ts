import { randomUUID } from "node:crypto";

import type { CareContextState } from "../post-care-insight/contract-constants";
import type { SolenOSResponse } from "../response-validator";
import {
  appendCareGraphNode,
  appendMemoryNode,
  bindActiveDecision,
  getOrCreateCareSession,
  resolveCareSessionId,
} from "./care-state-store";
import { evaluateRequiresPersistence } from "./persistence-evaluator";
import { resolveContinuityPrompt } from "./prompt-logic";
import type { ContinuityLayerPayload, CareGraphSummary, IdentityContinuityState } from "./types";

export interface EvaluatePostAnalyzeContinuityParams {
  input: string;
  source_type: "text" | "document";
  prior_input_raw?: string;
  resume_context?: boolean;
  care_context_state: CareContextState;
  result: SolenOSResponse;
  care_session_id?: string;
  user_id?: string;
  interaction_id?: string;
}

export interface EvaluatePostAnalyzeContinuityResult {
  care_session_id: string;
  continuity_layer: ContinuityLayerPayload;
  identity_state: IdentityContinuityState;
}

function buildCareGraphSummary(params: {
  result: SolenOSResponse;
  care_context_state: CareContextState;
  interaction_id?: string;
}): CareGraphSummary {
  return {
    what_is_happening: params.result.what_is_happening,
    what_matters_now: params.result.what_matters_now,
    risk_level: params.result.risk_level,
    care_context_state: params.care_context_state,
    interaction_id: params.interaction_id,
  };
}

/**
 * Post-analyze continuity evaluation — always after value is delivered.
 * Records care graph + memory nodes, then evaluates persistence need.
 */
export function evaluatePostAnalyzeContinuity(
  params: EvaluatePostAnalyzeContinuityParams,
): EvaluatePostAnalyzeContinuityResult {
  const careSessionId = resolveCareSessionId(params.care_session_id);

  let session = getOrCreateCareSession({
    care_session_id: careSessionId,
    user_id: params.user_id,
    mode: params.user_id ? undefined : "ephemeral",
  });

  const graphCountBefore = session.care_graph.nodes.length;
  const memoryCountBefore = session.memory_nodes.length;

  const summary = buildCareGraphSummary({
    result: params.result,
    care_context_state: params.care_context_state,
    interaction_id: params.interaction_id,
  });

  session = appendCareGraphNode(session, summary);

  const interactionId = params.interaction_id ?? randomUUID();
  session = appendMemoryNode(session, {
    interaction_id: interactionId,
    input_ref: params.input.slice(0, 500),
  }).session;

  bindActiveDecision(session, {
    interaction_id: interactionId,
    risk_level: params.result.risk_level,
    what_matters_now: params.result.what_matters_now,
  });

  const { signals, required, triggerIds } = evaluateRequiresPersistence({
    input: params.input,
    source_type: params.source_type,
    prior_input_raw: params.prior_input_raw,
    resume_context: params.resume_context,
    care_context_state: params.care_context_state,
    result: params.result,
    care_graph_node_count_before: graphCountBefore,
    memory_node_count_before: memoryCountBefore,
    identityState: session,
  });

  const continuity_prompt = resolveContinuityPrompt({
    identityState: session,
    persistenceRequired: required,
    signals,
    careGraphSummary: summary,
  });

  const continuity_layer: ContinuityLayerPayload = {
    continuity_prompt,
    identity_state: {
      mode: session.mode,
      care_session_id: session.care_session_id,
      has_stored_care_graph: session.has_stored_care_graph,
      auth_enabled: session.auth_enabled,
    },
    persistence_triggers: triggerIds,
  };

  return {
    care_session_id: session.care_session_id,
    continuity_layer,
    identity_state: session,
  };
}
