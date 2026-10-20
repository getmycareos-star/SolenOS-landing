import type { GroundingContextPackage } from "../telemetry-persistence/schema";
import type { SolenOSSettings } from "../settings-governance/types";
import type { BehaviorProfile } from "../input-classification";
import type { GovernanceApplicationResult } from "../settings-governance/types";
import { seedProfileFromSettingsCareContext } from "./bridge-settings";
import { runCareProfileSystemGuarantee } from "./guarantee";
import {
  bindCareProfileToUser,
  getUserCareProfileState,
  setUserCareProfileState,
} from "./persistence";
import { processInputForProfileUpdate } from "./update";
import {
  applyCareProfileBehaviorWeighting as applyBehaviorWeighting,
  computeCareProfileWeightEnvelope,
  mergeCareProfileWithModuleWeights,
} from "./weighting";
import type {
  CareProfileLayerPayload,
  CareProfileLayerResult,
  CareProfileState,
  CareProfileVersion,
} from "./types";

export type ProcessCareProfileLayerParams = {
  telemetry_user_id?: string;
  input: string;
  groundingContext?: GroundingContextPackage | null;
  governanceSettings?: SolenOSSettings;
  inferenceAllowed?: boolean;
};

const ANONYMOUS_USER_ID = "__anonymous__";

/**
 * CARE PROFILE LAYER — after memory/context, before emotional/time/priority weighting.
 * Updates profile from inference signals; returns weighting envelope only.
 */
export function processCareProfileLayer(
  params: ProcessCareProfileLayerParams,
): CareProfileLayerResult {
  const userId = params.telemetry_user_id ?? ANONYMOUS_USER_ID;
  const inferenceAllowed =
    params.inferenceAllowed ??
    !(params.governanceSettings?.privacyControl.disableInferenceEngine ?? false);

  let state = bindCareProfileToUser(userId, getUserCareProfileState(userId));

  if (params.governanceSettings?.careContext) {
    state = seedProfileFromSettingsCareContext(state, params.governanceSettings.careContext);
  }

  const updateResult = processInputForProfileUpdate(state, params.input, { inferenceAllowed });
  state = updateResult.state;

  if (params.telemetry_user_id) {
    setUserCareProfileState(params.telemetry_user_id, state);
  }

  const envelope = computeCareProfileWeightEnvelope(state.profile);
  const appliedUpdates: CareProfileVersion[] = updateResult.appliedVersion
    ? [updateResult.appliedVersion]
    : [];

  const guarantee = runCareProfileSystemGuarantee({
    state,
    envelope,
    conflictsResolvedOrFlagged:
      updateResult.conflicts.length === 0 ||
      state.pendingConflicts.every((c) => !c.resolved || c.resolved),
  });

  return {
    state,
    envelope,
    appliedUpdates,
    guarantee,
  };
}

export function applyCareProfileBehaviorWeighting(
  behaviorProfile: BehaviorProfile,
  layer: CareProfileLayerResult,
): BehaviorProfile {
  return applyBehaviorWeighting(behaviorProfile, layer.envelope);
}

export function applyCareProfileGovernanceWeighting(
  governance: GovernanceApplicationResult,
  layer: CareProfileLayerResult,
): GovernanceApplicationResult {
  const mergedWeights = mergeCareProfileWithModuleWeights(
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
        detail: `careProfile role=${layer.state.profile.roleInCareGraph} workload=${layer.state.profile.workloadIntensity} priority=${mergedWeights.priority.toFixed(2)}`,
      },
    ],
  };
}

export function toCareProfileLayerPayload(layer: CareProfileLayerResult): CareProfileLayerPayload {
  return {
    roleInCareGraph: layer.state.profile.roleInCareGraph,
    workloadIntensity: layer.state.profile.workloadIntensity,
    timeSensitivity: layer.state.profile.timeSensitivity,
    currentVersion: layer.state.currentVersion,
    pendingConflictCount: layer.state.pendingConflicts.filter((c) => !c.resolved).length,
    envelope: layer.envelope,
  };
}

export function getCareProfileStateForUser(userId: string): CareProfileState {
  return getUserCareProfileState(userId);
}
