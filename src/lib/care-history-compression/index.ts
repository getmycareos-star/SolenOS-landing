/**
 * Care History Compression (G57) — graceful long-term evolution.
 *
 * Living Care Record stores everything. Caregiver-facing projection must
 * summarize: recent focus + preserved important evidence — never an
 * unreadable multi-year dump.
 *
 * Principle-based (not illustration keywords). Raw observations remain durable.
 */

import { detectCareSignalFamily } from "../care-epistemics";

export const CARE_HISTORY_COMPRESSION_PURPOSE =
  "Project long care history for caregivers: recent + important preserved, older noise reduced — never a full dump.";

/** Observations older than this (vs now) compress unless marked important. */
export const LONG_HISTORY_RECENT_MS = 14 * 24 * 60 * 60 * 1000;

/** Caregiver-facing line budget (G57 must not dump). */
export const CAREGIVER_HISTORY_LINE_BUDGET = 5;

export type CompressibleObservation = {
  raw_text: string;
  human_fact?: string | null;
  captured_at: string;
};

export type GracefulLongTermProjection = {
  /** Recent observations (newest first), capped. */
  recent_focus: string[];
  /** Older evidence that must survive compression (safety / preference / unresolved). */
  preserved_important: string[];
  /** Count of older observations not listed (noise reduced, not discarded from store). */
  older_compressed_count: number;
  /** Total observations in the store. */
  total_observations: number;
  /** Caregiver-facing lines — always ≤ budget; never the full history. */
  caregiver_lines: string[];
  /** Always false when projection is used correctly. */
  dumps_full_history: boolean;
  /** True when history span or volume warrants compression. */
  compression_applied: boolean;
};

function lineFor(o: CompressibleObservation): string {
  return (o.human_fact || o.raw_text).trim().slice(0, 160);
}

function isImportantObservation(o: CompressibleObservation): boolean {
  const t = o.raw_text;
  const family = detectCareSignalFamily(t);
  if (
    family === "unattended_hazard" ||
    family === "needed_assistance" ||
    family === "wayfinding_difficulty" ||
    family === "missed_obligation"
  ) {
    return true;
  }
  // Preference / person-told usual — keep who they are
  if (
    /\b(usually|normally|always|loves?|hate[sd]?|prefers?|favorite)\b/i.test(t)
  ) {
    return true;
  }
  // Elevated independence / alone-safety language
  if (/\b(alone|by (?:her|him|them)self|without (?:help|me|us)|couldn'?t find)\b/i.test(t)) {
    return true;
  }
  return false;
}

/**
 * Project a long observation history for caregiver surfaces.
 * Does not mutate or delete stored observations.
 */
export function projectGracefulLongTermHistory(params: {
  observations: readonly CompressibleObservation[];
  familiarityStatements?: readonly string[];
  openUncertainties?: readonly string[];
  nowIso?: string;
  lineBudget?: number;
}): GracefulLongTermProjection {
  const budget = params.lineBudget ?? CAREGIVER_HISTORY_LINE_BUDGET;
  const now = Date.parse(params.nowIso ?? new Date().toISOString());
  const obs = [...params.observations].sort(
    (a, b) => Date.parse(a.captured_at) - Date.parse(b.captured_at),
  );
  const total = obs.length;

  const spanMs =
    total >= 2
      ? Date.parse(obs[obs.length - 1]!.captured_at) - Date.parse(obs[0]!.captured_at)
      : 0;
  const compression_applied =
    total > budget || spanMs >= LONG_HISTORY_RECENT_MS * 2;

  const recent: CompressibleObservation[] = [];
  const older: CompressibleObservation[] = [];
  for (const o of obs) {
    const age = now - Date.parse(o.captured_at);
    if (!Number.isFinite(age) || age <= LONG_HISTORY_RECENT_MS) {
      recent.push(o);
    } else {
      older.push(o);
    }
  }

  const recent_focus = recent
    .slice()
    .reverse()
    .map(lineFor)
    .filter(Boolean)
    .slice(0, 3);

  const preservedFromOlder = older
    .filter(isImportantObservation)
    .map(lineFor)
    .filter(Boolean)
    .slice(-3);

  const preserved_important = [
    ...preservedFromOlder,
    ...(params.familiarityStatements ?? [])
      .map((s) => s.trim().slice(0, 160))
      .filter(Boolean)
      .slice(0, 2),
    ...(params.openUncertainties ?? [])
      .map((s) => s.trim().slice(0, 160))
      .filter(Boolean)
      .slice(0, 2),
  ];
  const dedupedImportant = [...new Set(preserved_important)].slice(0, 4);

  const older_compressed_count = Math.max(
    0,
    older.length - preservedFromOlder.length,
  );

  const caregiver_lines = [
    ...recent_focus,
    ...dedupedImportant.filter((l) => !recent_focus.includes(l)),
  ].slice(0, budget);

  const dumps_full_history =
    compression_applied && caregiver_lines.length >= total && total > budget;

  return {
    recent_focus,
    preserved_important: dedupedImportant,
    older_compressed_count,
    total_observations: total,
    caregiver_lines,
    dumps_full_history,
    compression_applied,
  };
}
