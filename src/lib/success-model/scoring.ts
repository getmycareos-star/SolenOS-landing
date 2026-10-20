import type { MetricScore } from "./types";

export function scoreToLevel(score: number): MetricScore["level"] {
  if (score >= 75) return "strong";
  if (score >= 50) return "moderate";
  if (score >= 25) return "weak";
  return "insufficient";
}

export function buildMetricScore(
  metric: string,
  score: number,
  signals: string[],
): MetricScore {
  return {
    metric,
    score: Math.min(100, Math.max(0, Math.round(score))),
    level: scoreToLevel(score),
    signals,
  };
}

export function averageScores(scores: number[]): number {
  if (scores.length === 0) return 0;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}
