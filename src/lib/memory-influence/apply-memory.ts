import type { GroundingContextPackage } from "../telemetry-persistence/schema";
import type { SolenOSSettings } from "../settings-governance/types";
import type { BehaviorProfile } from "../input-classification";
import type { GovernanceApplicationResult } from "../settings-governance/types";
import type { SituationalCareContext } from "../care-context/situational/types";
import { DEFAULT_SOLENOS_SETTINGS } from "../settings-governance/defaults";
import { applyMemoryGovernanceConstraints } from "./bridge-settings";
import { runMemorySystemGuarantee } from "./guarantee";
import {
  bindMemoryInfluenceToUser,
  getUserMemoryInfluenceState,
  setUserMemoryInfluenceState,
} from "./persistence";
import { processInputForMemoryUpdate } from "./update";
import {
  applyMemoryBehaviorWeighting,
  computeMemoryInfluenceEnvelope,
  mergeMemoryWithModuleWeights,
} from "./weighting";
import type {
  MemoryInfluenceLayerPayload,
  MemoryInfluenceLayerResult,
} from "./types";

export type ProcessMemoryInfluenceLayerParams = {
  telemetry_user_id?: string;
  input: string;
  careContext?: SituationalCareContext;
  groundingContext?: GroundingContextPackage | null;
  governanceSettings?: SolenOSSettings;
  inferenceAllowed?: boolean;
};

const ANONYMOUS_USER_ID = "__anonymous__";

/**
 * MEMORY INFLUENCE LAYER — after Care Context, before pre-reasoning grounding and Care Profile.
 * Returns weighting envelope only — never raw memory as LLM facts.
 */
export function processMemoryInfluenceLayer(
  params: ProcessMemoryInfluenceLayerParams,
): MemoryInfluenceLayerResult {
  const userId = params.telemetry_user_id ?? ANONYMOUS_USER_ID;
  const settings = params.governanceSettings ?? DEFAULT_SOLENOS_SETTINGS;
  const inferenceAllowed =
    params.inferenceAllowed ??
    !(
      settings.privacyControl.disableInferenceEngine ||
      settings.privacyControl.disableBehaviorSignals
    );

  let state = bindMemoryInfluenceToUser(
    userId,
    getUserMemoryInfluenceState(userId, settings.memoryControl),
  );

  state = {
    ...state,
    memory: applyMemoryGovernanceConstraints(state.memory, settings.memoryControl),
  };

  const updateResult =
    settings.memoryControl.allowMemoryWrite
      ? processInputForMemoryUpdate(state, params.input, { inferenceAllowed })
      : { state, appliedUpdates: [] };
  state = updateResult.state;

  if (params.telemetry_user_id) {
    setUserMemoryInfluenceState(params.telemetry_user_id, state);
  }

  const envelope = computeMemoryInfluenceEnvelope(state.memory, params.careContext);
  const guarantee = runMemorySystemGuarantee({
    state,
    envelope,
    careContext: params.careContext,
  });

  return {
    state,
    envelope,
    appliedUpdates: updateResult.appliedUpdates,
    guarantee,
  };
}

export function applyMemoryInfluenceBehaviorWeighting(
  behaviorProfile: BehaviorProfile,
  layer: MemoryInfluenceLayerResult,
): BehaviorProfile {
  return applyMemoryBehaviorWeighting(behaviorProfile, layer.envelope);
}

export function applyMemoryInfluenceGovernanceWeighting(
  governance: GovernanceApplicationResult,
  layer: MemoryInfluenceLayerResult,
): GovernanceApplicationResult {
  const mergedWeights = mergeMemoryWithModuleWeights(governance.moduleWeights, layer.envelope);

  return {
    ...governance,
    moduleWeights: mergedWeights,
    appliedConstraints: [
      ...governance.appliedConstraints,
      {
        kind: "memory_module_weight",
        detail: `memoryInfluence composite=${layer.envelope.compositeInfluence.toFixed(2)} visibility=${layer.state.memory.visibility}`,
      },
    ],
  };
}

export function toMemoryInfluenceLayerPayload(
  layer: MemoryInfluenceLayerResult,
): MemoryInfluenceLayerPayload {
  const activeEntryCount =
    layer.state.memory.identityMemory.entries.length +
    layer.state.memory.longTermPatternMemory.entries.length +
    layer.state.memory.operationalMemory.entries.length +
    layer.state.memory.emotionalMemory.entries.length;

  return {
    visibility: layer.state.memory.visibility,
    activeEntryCount,
    compositeInfluence: layer.envelope.compositeInfluence,
    categoryWeights: layer.state.memory.memoryWeights,
    envelope: layer.envelope,
  };
}

export function getMemoryInfluenceStateForUser(userId: string) {
  return getUserMemoryInfluenceState(userId);
}

/**
 * Augment pre-reasoning grounding with influence envelope metadata only — NOT raw memory facts.
 */
export function mergeMemoryInfluenceIntoGroundingContext(
  groundingContext: GroundingContextPackage | null,
  layer: MemoryInfluenceLayerResult,
): GroundingContextPackage | null {
  if (!groundingContext || layer.envelope.interpretationHints.length === 0) {
    return groundingContext;
  }

  return {
    ...groundingContext,
    memory_influence_envelope: {
      compositeInfluence: layer.envelope.compositeInfluence,
      hints: Array.from(layer.envelope.interpretationHints),
    },
  };
}
