/**
 * In-memory stores with persistence stubs — MVP database structure.
 */

import type { BurnoutModel, CaregiverProfile, DetectedLoadSignalFamilies, LoadScores } from "../types";

const loadSignalsStore = new Map<string, DetectedLoadSignalFamilies>();
const loadScoresStore = new Map<string, LoadScores>();
const burnoutModelStore = new Map<string, BurnoutModel>();
const caregiverProfileStore = new Map<string, CaregiverProfile>();

export function saveLoadSignals(sessionId: string, signals: DetectedLoadSignalFamilies): void {
  loadSignalsStore.set(sessionId, signals);
}

export function getLoadSignals(sessionId: string): DetectedLoadSignalFamilies | undefined {
  return loadSignalsStore.get(sessionId);
}

export function saveLoadScores(sessionId: string, scores: LoadScores): void {
  loadScoresStore.set(sessionId, scores);
}

export function getLoadScores(sessionId: string): LoadScores | undefined {
  return loadScoresStore.get(sessionId);
}

export function saveBurnoutModel(sessionId: string, model: BurnoutModel): void {
  burnoutModelStore.set(sessionId, model);
}

export function getBurnoutModel(sessionId: string): BurnoutModel | undefined {
  return burnoutModelStore.get(sessionId);
}

export function saveCaregiverProfile(sessionId: string, profile: CaregiverProfile): void {
  caregiverProfileStore.set(sessionId, profile);
}

export function getCaregiverProfile(sessionId: string): CaregiverProfile | undefined {
  return caregiverProfileStore.get(sessionId);
}

/** Persistence stub — no-op for MVP. */
export async function persistCaregiverLoadStores(_sessionId: string): Promise<void> {
  // Stub: wire to postgres when persistence layer is ready.
}

export function resetCaregiverLoadStores(): void {
  loadSignalsStore.clear();
  loadScoresStore.clear();
  burnoutModelStore.clear();
  caregiverProfileStore.clear();
}

export function persistSessionLoadState(
  sessionId: string,
  signals: DetectedLoadSignalFamilies,
  scores: LoadScores,
  burnout: BurnoutModel,
  profile?: CaregiverProfile,
): void {
  saveLoadSignals(sessionId, signals);
  saveLoadScores(sessionId, scores);
  saveBurnoutModel(sessionId, burnout);
  if (profile) saveCaregiverProfile(sessionId, profile);
}
