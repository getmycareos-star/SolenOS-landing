import type {
  CareProfile,
  CareProfileLayerResult,
  CareProfileState,
  CareProfileSystemGuaranteeResult,
  CareProfileWeightEnvelope,
} from "./types";

function careGraphConsistent(profile: CareProfile): string[] {
  const violations: string[] = [];

  if (profile.roleInCareGraph === "observer" && profile.careRelationships.dependents.length > 0) {
    violations.push("observer role with active dependents is inconsistent");
  }

  if (
    profile.roleInCareGraph === "shared_caregiver" &&
    profile.careRelationships.sharedCareWith.length === 0 &&
    profile.careRelationships.dependents.length > 0
  ) {
    violations.push("shared_caregiver without sharedCareWith entries");
  }

  return violations;
}

/**
 * System guarantee before output — care profile loaded, graph consistent, weights applied.
 */
export function runCareProfileSystemGuarantee(params: {
  state: CareProfileState;
  envelope: CareProfileWeightEnvelope;
  conflictsResolvedOrFlagged: boolean;
}): CareProfileSystemGuaranteeResult {
  const violations: string[] = [];

  if (!params.state) {
    violations.push("care profile not loaded");
  }

  if (!params.state.profile) {
    violations.push("missing current profile");
  }

  if (params.state.currentVersion < 1) {
    violations.push("invalid profile version");
  }

  if (params.state.history.length === 0) {
    violations.push("profile history missing");
  }

  violations.push(...careGraphConsistent(params.state.profile));

  if (!params.envelope) {
    violations.push("workload intensity envelope not applied");
  } else {
    if (params.envelope.roleWeight <= 0) {
      violations.push("role weighting not applied");
    }
    if (params.envelope.compressionFactor <= 0) {
      violations.push("workload compression not applied");
    }
  }

  if (!params.conflictsResolvedOrFlagged && params.state.pendingConflicts.some((c) => !c.resolved)) {
    violations.push("unresolved profile conflicts not flagged");
  }

  return { ok: violations.length === 0, violations };
}

export function validateCareProfileLayerResult(result: CareProfileLayerResult): CareProfileSystemGuaranteeResult {
  return runCareProfileSystemGuarantee({
    state: result.state,
    envelope: result.envelope,
    conflictsResolvedOrFlagged: true,
  });
}
