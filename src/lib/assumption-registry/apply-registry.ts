import type { CareProfile } from "../care-profile/types";
import type { SituationalCareContext } from "../care-context/situational/types";
import type { DocumentIntelligenceLayerResult } from "../document-intelligence/types";
import type { BehaviorProfile } from "../input-classification";
import type { GovernanceApplicationResult } from "../settings-governance/types";
import type { TrackedSituation } from "../resolution-engine";
import {
  bindAssumptionRegistryToUser,
  getUserAssumptionRegistryState,
  setUserAssumptionRegistryState,
} from "./persistence";
import { applyAssumptionExpiration } from "./expiration";
import {
  detectAssumptionSignalsFromInput,
  detectContradictoryInvalidations,
  detectDocumentAssumptionSignals,
} from "./detectors";
import {
  invalidateAssumptionsForResolvedSituations,
  seedAssumptionsFromCareProfile,
  seedAssumptionsFromSignals,
} from "./seeding";
import { computeAssumptionInfluenceEnvelope } from "./influence";
import { runAssumptionRegistryGuarantee } from "./guarantee";
import {
  applyAssumptionBehaviorWeighting,
  mergeAssumptionWithModuleWeights,
} from "./weighting";
import type {
  AssumptionRegistryLayerPayload,
  AssumptionRegistryLayerResult,
  AssumptionRegistryPolicy,
} from "./types";

export type ProcessAssumptionRegistryLayerParams = {
  telemetry_user_id?: string;
  input: string;
  careProfile?: CareProfile;
  careContext?: SituationalCareContext;
  trackedSituations?: readonly TrackedSituation[];
  documentIntelligence?: DocumentIntelligenceLayerResult;
  policy?: Partial<AssumptionRegistryPolicy>;
  nowMs?: number;
};

const ANONYMOUS_USER_ID = "__anonymous__";

/**
 * ASSUMPTION REGISTRY LAYER — after Memory Influence; before Priority Engine.
 * Tracks temporary beliefs influencing decisions — never memory truth or profile identity.
 */
export function processAssumptionRegistryLayer(
  params: ProcessAssumptionRegistryLayerParams,
): AssumptionRegistryLayerResult {
  const userId = params.telemetry_user_id ?? ANONYMOUS_USER_ID;
  const nowMs = params.nowMs ?? Date.now();

  let state = bindAssumptionRegistryToUser(
    userId,
    getUserAssumptionRegistryState(userId),
  );

  if (params.policy) {
    state = {
      ...state,
      policy: { ...state.policy, ...params.policy },
    };
  }

  const invalidations: import("./types").AssumptionInvalidationEvent[] = [];

  // Periodic expiration — assumptions must NEVER live forever.
  const expired = applyAssumptionExpiration(state, nowMs);
  state = expired.state;
  const expirations = expired.expiredIds;

  // Resolution may invalidate situation-linked assumptions.
  if (params.trackedSituations && params.trackedSituations.length > 0) {
    const resolved = invalidateAssumptionsForResolvedSituations(
      state,
      params.trackedSituations,
      nowMs,
    );
    state = resolved.state;
    invalidations.push(...resolved.events);
  }

  // Contradictory evidence from user input and documents.
  const contradictions = detectContradictoryInvalidations(state, {
    input: params.input,
    documentIntelligence: params.documentIntelligence,
    nowMs,
  });
  state = contradictions.state;
  invalidations.push(...contradictions.events);

  // Seed from care profile role — NOT merged into profile identity.
  state = seedAssumptionsFromCareProfile(state, params.careProfile, nowMs);

  // Detect and register new assumptions from input.
  const inputSignals = detectAssumptionSignalsFromInput(params.input);
  const docSignals = detectDocumentAssumptionSignals(params.documentIntelligence);
  state = seedAssumptionsFromSignals(state, [...inputSignals, ...docSignals], nowMs);

  if (params.telemetry_user_id) {
    setUserAssumptionRegistryState(params.telemetry_user_id, state);
  }

  const envelope = computeAssumptionInfluenceEnvelope(state, nowMs);
  const guarantee = runAssumptionRegistryGuarantee({ state, envelope });

  return {
    state,
    envelope,
    invalidations,
    expirations,
    guarantee,
  };
}

export function applyAssumptionRegistryBehaviorWeighting(
  behaviorProfile: BehaviorProfile,
  layer: AssumptionRegistryLayerResult,
): BehaviorProfile {
  return applyAssumptionBehaviorWeighting(behaviorProfile, layer.envelope);
}

export function applyAssumptionRegistryGovernanceWeighting(
  governance: GovernanceApplicationResult,
  layer: AssumptionRegistryLayerResult,
): GovernanceApplicationResult {
  const mergedWeights = mergeAssumptionWithModuleWeights(
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
        detail: `assumptionRegistry influenceable=${layer.envelope.influenceableCount} bias=${layer.envelope.compositeBias.toFixed(2)} stale=${layer.envelope.staleInfluenceCount}`,
      },
    ],
  };
}

export function toAssumptionRegistryLayerPayload(
  layer: AssumptionRegistryLayerResult,
): AssumptionRegistryLayerPayload {
  return {
    influenceableCount: layer.envelope.influenceableCount,
    compositeBias: layer.envelope.compositeBias,
    staleInfluenceCount: layer.envelope.staleInfluenceCount,
    health: layer.envelope.health,
    influenceHints: layer.envelope.influenceHints,
    recentInvalidations: layer.invalidations.slice(-5),
  };
}

export function formatAssumptionRegistryObservation(
  layer: AssumptionRegistryLayerResult,
): string {
  const h = layer.envelope.health;
  return `OBSERVATION: ASSUMPTION_REGISTRY active=${h.activeAssumptions} stale=${h.staleAssumptions} invalidated=${h.invalidatedAssumptions} bias=${layer.envelope.compositeBias.toFixed(2)}`;
}

/**
 * Post-document pass — invalidate from document evidence without reseeding from empty input.
 */
export function refreshAssumptionRegistryFromDocuments(
  layer: AssumptionRegistryLayerResult,
  documentIntelligence: DocumentIntelligenceLayerResult,
  telemetry_user_id?: string,
): AssumptionRegistryLayerResult {
  const nowMs = Date.now();
  let state = layer.state;

  const contradictions = detectContradictoryInvalidations(state, {
    documentIntelligence,
    nowMs,
  });
  state = contradictions.state;

  const docSignals = detectDocumentAssumptionSignals(documentIntelligence);
  state = seedAssumptionsFromSignals(state, docSignals, nowMs);

  if (telemetry_user_id) {
    setUserAssumptionRegistryState(telemetry_user_id, state);
  }

  const envelope = computeAssumptionInfluenceEnvelope(state, nowMs);
  const guarantee = runAssumptionRegistryGuarantee({ state, envelope });

  return {
    state,
    envelope,
    invalidations: [...layer.invalidations, ...contradictions.events],
    expirations: layer.expirations,
    guarantee,
  };
}

export function getAssumptionRegistryStateForUser(userId: string) {
  return getUserAssumptionRegistryState(userId);
}
