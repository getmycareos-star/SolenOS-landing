import { randomUUID } from "node:crypto";
import type {
  RealityDriftDetectionInput,
  RealityDriftDetectionResult,
  RealityDriftSignal,
} from "./types";

const STUB_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function isStale(iso?: string): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return false;
  return Date.now() - t > STUB_AGE_MS;
}

/**
 * Stub reality drift detector — heuristic only; no STATE/BELIEF mutation.
 */
export function detectRealityDrift(
  input: RealityDriftDetectionInput,
): RealityDriftDetectionResult {
  const signals: RealityDriftSignal[] = [];
  const now = new Date().toISOString();
  const obs = (input.observation ?? "").toLowerCase();

  if (obs.includes("wrong") || obs.includes("outdated") || obs.includes("not true")) {
    signals.push({
      id: randomUUID(),
      situationId: input.situationId,
      kind: "context_mismatch",
      summary: "User indicated lived reality may diverge from stored context (stub).",
      severity: "MEDIUM",
      detectedAt: now,
    });
  }

  if (isStale(input.lastBeliefUpdateAt) && isStale(input.lastStateUpdateAt)) {
    signals.push({
      id: randomUUID(),
      situationId: input.situationId,
      kind: "stale_assumption",
      summary: "STATE and BELIEF timestamps exceed stub drift window (7d).",
      severity: "LOW",
      detectedAt: now,
    });
  }

  if (obs.includes("contradict") || obs.includes("conflict")) {
    signals.push({
      id: randomUUID(),
      situationId: input.situationId,
      kind: "timeline_contradiction",
      summary: "Possible timeline contradiction flagged from observation text (stub).",
      severity: "HIGH",
      detectedAt: now,
    });
  }

  return {
    signals,
    driftDetected: signals.length > 0,
  };
}
