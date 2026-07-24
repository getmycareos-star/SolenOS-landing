import type { SolenOSOutput } from "../output-contract/types";

/** In-session Cognitive Relief Rate tracking — not persisted (per boundary). */
export interface SessionReliefMetrics {
  analyzeCount: number;
  repeatedQueries: number;
  frustrationSignals: number;
  successfulExits: number;
}

export function createSessionMetrics(): SessionReliefMetrics {
  return {
    analyzeCount: 0,
    repeatedQueries: 0,
    frustrationSignals: 0,
    successfulExits: 0,
  };
}

export function recordAnalyze(
  metrics: SessionReliefMetrics,
  input: string,
  priorInputs: string[],
): SessionReliefMetrics {
  const normalized = input.toLowerCase().trim();
  const isRepeat = priorInputs.some((p) => p.toLowerCase().trim() === normalized);

  return {
    ...metrics,
    analyzeCount: metrics.analyzeCount + 1,
    repeatedQueries: metrics.repeatedQueries + (isRepeat ? 1 : 0),
  };
}

export function cognitiveReliefRate(metrics: SessionReliefMetrics): number {
  if (metrics.analyzeCount === 0) return 0;
  const penalty =
    metrics.repeatedQueries * 0.3 + metrics.frustrationSignals * 0.4;
  const bonus = metrics.successfulExits * 0.2;
  return Math.max(
    0,
    Math.min(100, Math.round((1 - penalty + bonus) * 100)),
  );
}

export function isOutputIncreasingLoad(
  output: SolenOSOutput,
  requeryCount: number,
): boolean {
  const tooLong =
    output.what_is_happening.length > 500 ||
    output.what_matters_now.length > 400;
  return tooLong || requeryCount >= 3;
}
