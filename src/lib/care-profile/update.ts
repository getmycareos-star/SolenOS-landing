import {
  INFERENCE_CONFIDENCE_THRESHOLD,
  INFERENCE_SIGNAL_REPEAT_THRESHOLD,
} from "./contract-constants";
import {
  detectInferenceSignals,
  mergeDependentsUnique,
  mergePartialProfile,
} from "./signals";
import type {
  CareProfile,
  CareProfileConflict,
  CareProfileState,
  CareProfileUpdateMode,
  CareProfileVersion,
  InferenceSignal,
} from "./types";

function nowIso(): string {
  return new Date().toISOString();
}

function signalKey(signal: InferenceSignal): string {
  return `${signal.kind}:${signal.detail}`;
}

function profilesEqual(a: CareProfile, b: CareProfile): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function detectConflicts(
  stored: CareProfile,
  inferred: CareProfile,
): CareProfileConflict[] {
  const conflicts: CareProfileConflict[] = [];
  const ts = nowIso();

  if (stored.roleInCareGraph !== inferred.roleInCareGraph) {
    conflicts.push({
      field: "roleInCareGraph",
      storedValue: stored.roleInCareGraph,
      inferredValue: inferred.roleInCareGraph,
      detectedAt: ts,
      resolved: false,
    });
  }

  if (
    inferred.careRelationships.dependents.length > 0 &&
    stored.careRelationships.dependents.length > 0 &&
    !inferred.careRelationships.dependents.some((d) =>
      stored.careRelationships.dependents.includes(d),
    )
  ) {
    conflicts.push({
      field: "careRelationships.dependents",
      storedValue: stored.careRelationships.dependents,
      inferredValue: inferred.careRelationships.dependents,
      detectedAt: ts,
      resolved: false,
    });
  }

  return conflicts;
}

function applyProfileUpdate(
  state: CareProfileState,
  nextProfile: CareProfile,
  updateMode: CareProfileUpdateMode,
  confidence: number,
  reason: string,
): CareProfileState {
  if (profilesEqual(state.profile, nextProfile)) {
    return state;
  }

  const nextVersion = state.currentVersion + 1;
  const version: CareProfileVersion = {
    version: nextVersion,
    profile: nextProfile,
    updatedAt: nowIso(),
    updateMode,
    confidence,
    reason,
  };

  return {
    ...state,
    currentVersion: nextVersion,
    profile: nextProfile,
    history: [...state.history, version],
  };
}

function foldSignalsIntoProfile(base: CareProfile, signals: InferenceSignal[]): CareProfile {
  let profile = { ...base };

  for (const signal of signals) {
    if (!signal.partial) continue;
    profile = mergePartialProfile(profile, signal.partial);
    if (signal.partial.careRelationships?.dependents) {
      profile = {
        ...profile,
        careRelationships: {
          ...profile.careRelationships,
          dependents: mergeDependentsUnique(
            profile.careRelationships.dependents,
            signal.partial.careRelationships.dependents,
          ),
          sharedCareWith: mergeDependentsUnique(
            profile.careRelationships.sharedCareWith,
            signal.partial.careRelationships.sharedCareWith ?? [],
          ),
          externalCaregivers: mergeDependentsUnique(
            profile.careRelationships.externalCaregivers,
            signal.partial.careRelationships.externalCaregivers ?? [],
          ),
        },
      };
    }
  }

  return profile;
}

export type ProfileUpdateResult = {
  state: CareProfileState;
  appliedVersion?: CareProfileVersion;
  conflicts: CareProfileConflict[];
};

/**
 * Apply inference signals with update mode routing:
 * - USER_CONFIRMED: immediate update
 * - INFERRED: requires confidence + repeated signals
 * - CONFLICT_RESOLUTION: flag mismatch, do not overwrite silently
 */
export function applyInferenceSignals(
  state: CareProfileState,
  signals: InferenceSignal[],
  options: { inferenceAllowed: boolean },
): ProfileUpdateResult {
  if (!options.inferenceAllowed || signals.length === 0) {
    return { state, conflicts: [] };
  }

  const userConfirmed = signals.filter((s) => s.kind.startsWith("user_confirmed"));
  if (userConfirmed.length > 0) {
    const inferred = foldSignalsIntoProfile(state.profile, userConfirmed);
    const next = applyProfileUpdate(
      state,
      inferred,
      "USER_CONFIRMED",
      1,
      userConfirmed.map((s) => s.detail).join("; "),
    );
    const version = next.history[next.history.length - 1];
    return { state: next, appliedVersion: version, conflicts: [] };
  }

  const counts = { ...state.inferenceSignalCounts };
  for (const signal of signals) {
    const key = signalKey(signal);
    counts[key] = (counts[key] ?? 0) + 1;
  }

  const repeatedSignals = signals.filter(
    (s) => (counts[signalKey(s)] ?? 0) >= INFERENCE_SIGNAL_REPEAT_THRESHOLD,
  );
  const confidentSignals = repeatedSignals.filter(
    (s) => s.confidence >= INFERENCE_CONFIDENCE_THRESHOLD,
  );

  if (confidentSignals.length === 0) {
    return {
      state: { ...state, inferenceSignalCounts: counts },
      conflicts: [],
    };
  }

  const inferredProfile = foldSignalsIntoProfile(state.profile, confidentSignals);
  const conflicts = detectConflicts(state.profile, inferredProfile);

  if (conflicts.length > 0) {
    const conflictState: CareProfileState = {
      ...state,
      inferenceSignalCounts: counts,
      pendingConflicts: [...state.pendingConflicts, ...conflicts],
    };
    const version: CareProfileVersion = {
      version: state.currentVersion,
      profile: state.profile,
      updatedAt: nowIso(),
      updateMode: "CONFLICT_RESOLUTION",
      confidence: Math.max(...confidentSignals.map((s) => s.confidence)),
      reason: `conflict flagged: ${conflicts.map((c) => c.field).join(", ")}`,
    };
    return {
      state: {
        ...conflictState,
        history: [...conflictState.history, version],
      },
      conflicts,
    };
  }

  const next = applyProfileUpdate(
    { ...state, inferenceSignalCounts: counts },
    inferredProfile,
    "INFERRED",
    Math.max(...confidentSignals.map((s) => s.confidence)),
    confidentSignals.map((s) => s.detail).join("; "),
  );
  const version = next.history[next.history.length - 1];
  return { state: next, appliedVersion: version, conflicts: [] };
}

export function processInputForProfileUpdate(
  state: CareProfileState,
  input: string,
  options: { inferenceAllowed: boolean },
): ProfileUpdateResult {
  const signals = detectInferenceSignals(input);
  return applyInferenceSignals(state, signals, options);
}

export function rollbackToVersion(
  state: CareProfileState,
  targetVersion: number,
): CareProfileState {
  const entry = state.history.find((h) => h.version === targetVersion);
  if (!entry) return state;

  const nextVersion = state.currentVersion + 1;
  const rollbackVersion: CareProfileVersion = {
    version: nextVersion,
    profile: entry.profile,
    updatedAt: nowIso(),
    updateMode: "USER_CONFIRMED",
    confidence: 1,
    reason: `rollback to version ${targetVersion}`,
  };

  return {
    ...state,
    currentVersion: nextVersion,
    profile: entry.profile,
    history: [...state.history, rollbackVersion],
  };
}
