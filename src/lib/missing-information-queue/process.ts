import type { ClarificationGateResult } from "../ambiguity-structure-validation/types";
import type { CareProfile } from "../care-profile/types";
import type { SituationalCareContext } from "../care-context/situational/types";
import type { DocumentIntelligenceLayerResult } from "../document-intelligence/types";
import type { BehaviorProfile } from "../input-classification";
import type { MemoryInfluenceState } from "../memory-influence/types";
import type { GovernanceApplicationResult } from "../settings-governance/types";
import type { TrackedSituation } from "../resolution-engine";
import type { TimeEngineLayerResult } from "../time-engine/types";
import { applyMissingInformationExpiration } from "./expiration";
import {
  detectMissingFromDocuments,
  detectMissingFromMemory,
  detectMissingFromReasoning,
  detectMissingFromUserInput,
} from "./generators";
import { runMissingInformationQueueGuarantee } from "./guarantee";
import { computeMissingInformationInfluenceEnvelope } from "./influence";
import {
  bindMissingInformationQueueToUser,
  getUserMissingInformationQueueState,
  setUserMissingInformationQueueState,
} from "./persistence";
import { autoResolveMissingInformation } from "./resolution";
import { seedMissingInformationFromSignals } from "./seeding";
import {
  applyMissingInformationBehaviorWeighting,
  mergeMissingInformationWithModuleWeights,
} from "./weighting";
import type {
  MissingInformationQueueLayerPayload,
  MissingInformationQueueLayerResult,
  MissingInformationQueuePolicy,
  MissingInformationResolutionEvent,
} from "./types";

export type ProcessMissingInformationQueueLayerParams = {
  telemetry_user_id?: string;
  input: string;
  careProfile?: CareProfile;
  careContext?: SituationalCareContext;
  trackedSituations?: readonly TrackedSituation[];
  timeEngine?: TimeEngineLayerResult;
  clarityGate?: ClarificationGateResult;
  memoryState?: MemoryInfluenceState;
  documentIntelligence?: DocumentIntelligenceLayerResult;
  /** Preferred situation scope; defaults to first ACTIVE tracked situation. */
  situationId?: string;
  policy?: Partial<MissingInformationQueuePolicy>;
  nowMs?: number;
};

const ANONYMOUS_USER_ID = "__anonymous__";

function resolveSituationId(params: ProcessMissingInformationQueueLayerParams): string | null {
  if (params.situationId?.trim()) return params.situationId.trim();
  const active = (params.trackedSituations ?? []).filter((s) => s.status === "ACTIVE");
  if (active[0]?.id) return active[0].id;
  const any = params.trackedSituations?.[0]?.id;
  return any?.trim() || null;
}

/**
 * MISSING INFORMATION QUEUE — after Assumption Registry; before Priority Engine.
 * Tracks knowledge gaps only — never tasks or checklists.
 */
export function processMissingInformationQueueLayer(
  params: ProcessMissingInformationQueueLayerParams,
): MissingInformationQueueLayerResult {
  const userId = params.telemetry_user_id ?? ANONYMOUS_USER_ID;
  const nowMs = params.nowMs ?? Date.now();
  const situationId = resolveSituationId(params);

  let state = bindMissingInformationQueueToUser(
    userId,
    getUserMissingInformationQueueState(userId),
  );

  if (params.policy) {
    state = {
      ...state,
      policy: { ...state.policy, ...params.policy },
    };
  }

  const resolutions: MissingInformationResolutionEvent[] = [];

  const expired = applyMissingInformationExpiration(state, nowMs);
  state = expired.state;
  const expirations = expired.expiredIds;

  // Auto-resolve when evidence answers open gaps.
  const resolved = autoResolveMissingInformation(state, {
    input: params.input,
    documentIntelligence: params.documentIntelligence,
    memoryState: params.memoryState,
    nowMs,
  });
  state = resolved.state;
  resolutions.push(...resolved.events);

  if (situationId) {
    const signals = [
      ...detectMissingFromReasoning({
        careContext: params.careContext,
        timeEngine: params.timeEngine,
        clarityGate: params.clarityGate,
      }),
      ...detectMissingFromDocuments(params.documentIntelligence),
      ...detectMissingFromMemory(params.memoryState, params.careContext),
      ...detectMissingFromUserInput(params.input),
    ];
    state = seedMissingInformationFromSignals(state, signals, situationId, nowMs);
  }

  if (params.telemetry_user_id) {
    setUserMissingInformationQueueState(params.telemetry_user_id, state);
  }

  // Envelope aggregates all open items for the user (items remain situation-scoped).
  const envelope = computeMissingInformationInfluenceEnvelope(state);
  const guarantee = runMissingInformationQueueGuarantee({ state, envelope });

  return {
    state,
    envelope,
    resolutions,
    expirations,
    guarantee,
  };
}

export function applyMissingInformationQueueBehaviorWeighting(
  behaviorProfile: BehaviorProfile,
  layer: MissingInformationQueueLayerResult,
): BehaviorProfile {
  return applyMissingInformationBehaviorWeighting(behaviorProfile, layer.envelope);
}

export function applyMissingInformationQueueGovernanceWeighting(
  governance: GovernanceApplicationResult,
  layer: MissingInformationQueueLayerResult,
): GovernanceApplicationResult {
  const mergedWeights = mergeMissingInformationWithModuleWeights(
    governance.moduleWeights,
    layer.envelope,
  );

  return {
    ...governance,
    moduleWeights: mergedWeights,
    appliedConstraints: [
      ...governance.appliedConstraints,
      {
        kind: "memory_module_weight",
        detail: `missingInformation open=${layer.envelope.openCount} high=${layer.envelope.highPriorityOpenCount} confPenalty=${layer.envelope.confidencePenalty.toFixed(2)}`,
      },
    ],
  };
}

export function toMissingInformationQueueLayerPayload(
  layer: MissingInformationQueueLayerResult,
): MissingInformationQueueLayerPayload {
  return {
    openCount: layer.envelope.openCount,
    highPriorityOpenCount: layer.envelope.highPriorityOpenCount,
    confidencePenalty: layer.envelope.confidencePenalty,
    uncertaintyBoost: layer.envelope.uncertaintyBoost,
    needsNext: layer.envelope.needsNext,
    health: layer.envelope.health,
    recentResolutions: layer.resolutions.slice(-5),
  };
}

export function formatMissingInformationQueueObservation(
  layer: MissingInformationQueueLayerResult,
): string {
  const h = layer.envelope.health;
  return `OBSERVATION: MISSING_INFORMATION_QUEUE open=${h.openItems} high=${h.highPriorityItems} resolved=${h.resolvedItems} uncertaintyBoost=${layer.envelope.uncertaintyBoost.toFixed(2)}`;
}

/**
 * Post-document pass — resolve and seed from document evidence.
 */
export function refreshMissingInformationQueueFromDocuments(
  layer: MissingInformationQueueLayerResult,
  documentIntelligence: DocumentIntelligenceLayerResult,
  params: {
    telemetry_user_id?: string;
    situationId?: string;
    input?: string;
    nowMs?: number;
  } = {},
): MissingInformationQueueLayerResult {
  const nowMs = params.nowMs ?? Date.now();
  let state = layer.state;

  const resolved = autoResolveMissingInformation(state, {
    input: params.input,
    documentIntelligence,
    nowMs,
  });
  state = resolved.state;

  const situationId =
    params.situationId ??
    state.items.find((i) => i.status === "open")?.situationId ??
    null;

  if (situationId) {
    const docSignals = detectMissingFromDocuments(documentIntelligence);
    state = seedMissingInformationFromSignals(state, docSignals, situationId, nowMs);
  }

  if (params.telemetry_user_id) {
    setUserMissingInformationQueueState(params.telemetry_user_id, state);
  }

  const envelope = computeMissingInformationInfluenceEnvelope(state);
  const guarantee = runMissingInformationQueueGuarantee({ state, envelope });

  return {
    state,
    envelope,
    resolutions: [...layer.resolutions, ...resolved.events],
    expirations: layer.expirations,
    guarantee,
  };
}

export function getMissingInformationQueueStateForUser(userId: string) {
  return getUserMissingInformationQueueState(userId);
}
