import type { CareContextProfile, SolenOSSettings } from "../settings-governance/types";
import type { CareProfile, CareProfileState } from "./types";

/**
 * Bridge: living Care Profile → settings CareContextProfile mirror.
 * Settings careContext consumes profile weights; it is NOT the source of truth.
 */
export function toCareContextProfile(profile: CareProfile): CareContextProfile {
  return {
    roleInCareGraph: profile.roleInCareGraph,
    careRelationships: {
      dependents: [...profile.careRelationships.dependents],
      sharedCareWith: [...profile.careRelationships.sharedCareWith],
      externalCaregivers: [...profile.careRelationships.externalCaregivers],
    },
    conditionSignals: { ...profile.conditionSignals },
    workloadIntensity: profile.workloadIntensity,
    timeSensitivity: profile.timeSensitivity,
  };
}

/**
 * Sync governance settings careContext from living profile without overwriting other settings.
 */
export function syncSettingsCareContextFromProfile(
  settings: SolenOSSettings,
  profile: CareProfile,
): SolenOSSettings {
  return {
    ...settings,
    careContext: toCareContextProfile(profile),
  };
}

/**
 * When settings explicitly define careContext and no profile history exists,
 * seed profile from settings (one-time bootstrap only).
 */
export function seedProfileFromSettingsCareContext(
  state: CareProfileState,
  careContext: CareContextProfile,
): CareProfileState {
  if (state.history.length > 1 || state.currentVersion > 1) {
    return state;
  }

  const profile: CareProfile = {
    roleInCareGraph: careContext.roleInCareGraph,
    careRelationships: {
      dependents: [...careContext.careRelationships.dependents],
      sharedCareWith: [...careContext.careRelationships.sharedCareWith],
      externalCaregivers: [...careContext.careRelationships.externalCaregivers],
    },
    conditionSignals: { ...careContext.conditionSignals },
    workloadIntensity: careContext.workloadIntensity,
    timeSensitivity: careContext.timeSensitivity,
  };

  return {
    ...state,
    profile,
    history: [
      {
        version: 1,
        profile,
        updatedAt: state.history[0]?.updatedAt ?? new Date().toISOString(),
        updateMode: "USER_CONFIRMED",
        confidence: 1,
        reason: "seeded from settings careContext",
      },
    ],
  };
}
