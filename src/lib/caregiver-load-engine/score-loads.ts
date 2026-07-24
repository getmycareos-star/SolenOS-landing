import type { DetectedLoadSignalFamilies, LoadScores } from "./types";

function clamp100(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, Math.round(n * 1000) / 1000));
}

/**
 * Signal families → five load dimension scores (0–100 except uncertaintyIndex 0–1).
 */
export function scoreLoadDimensions(signals: DetectedLoadSignalFamilies): LoadScores {
  const cognitiveLoadScore = clamp100(
    signals.repetition * 30 +
      signals.vigilance * 28 +
      signals.supervision * 22 +
      signals.uncertainty * 12 +
      signals.assistance * 8,
  );

  const emotionalLoadScore = clamp100(
    signals.emotionalDistress * 40 +
      signals.burnoutLanguage * 30 +
      signals.repetition * 15 +
      signals.uncertainty * 10,
  );

  const sleepRiskScore = clamp100(
    signals.sleep * 55 +
      signals.supervision * 20 +
      signals.burnoutLanguage * 15,
  );

  const uncertaintyIndex = clamp01(
    signals.uncertainty * 0.55 +
      signals.repetition * 0.2 +
      signals.assistance * 0.15 +
      signals.emotionalDistress * 0.1,
  );

  const dependencyLoadScore = clamp100(
    signals.supervision * 40 +
      signals.assistance * 35 +
      signals.repetition * 10 +
      signals.sleep * 10,
  );

  return {
    cognitiveLoadScore,
    emotionalLoadScore,
    sleepRiskScore,
    uncertaintyIndex,
    dependencyLoadScore,
  };
}
