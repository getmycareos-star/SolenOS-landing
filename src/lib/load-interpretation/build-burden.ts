import { PRIMARY_CONTRIBUTOR_LABELS } from "./contract-constants";
import type { DetectedLoadSignals, LoadSignalCategory } from "./types";

function contributorLabel(category: LoadSignalCategory): string {
  return PRIMARY_CONTRIBUTOR_LABELS[category];
}

function rankContributors(signals: DetectedLoadSignals): LoadSignalCategory[] {
  const entries: [LoadSignalCategory, number][] = [
    ["emotionalLoad", signals.emotionalLoad],
    ["sleepRisk", signals.sleepRisk],
    ["uncertaintyIndex", signals.uncertaintyIndex],
    ["cognitiveLoad", signals.cognitiveLoad],
    ["burnoutProbability", signals.burnoutProbability],
  ];
  return entries
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([cat]) => cat);
}

export function buildPrimaryContributors(signals: DetectedLoadSignals): string[] {
  const ranked = rankContributors(signals);
  if (ranked.length === 0) return [];
  return ranked.slice(0, 3).map(contributorLabel);
}

export function buildBurdenSummary(
  signals: DetectedLoadSignals,
  emotionalLoadScore: number,
): string {
  void emotionalLoadScore;
  const contributors = buildPrimaryContributors(signals);
  if (contributors.length === 0) {
    return "What you shared is held in the Living Care Record.";
  }

  if (contributors.length === 1) {
    return `Held from what you shared: ${contributors[0]}.`;
  }

  if (contributors.length === 2) {
    return `Held from what you shared: ${contributors[0]} and ${contributors[1]}.`;
  }

  const last = contributors[contributors.length - 1];
  const rest = contributors.slice(0, -1).join(", ");
  return `Held from what you shared: ${rest}, and ${last}.`;
}

export function computeEmotionalLoadScore(signals: DetectedLoadSignals): number {
  const composite =
    signals.emotionalLoad * 30 +
    signals.sleepRisk * 22 +
    signals.uncertaintyIndex * 18 +
    signals.cognitiveLoad * 15 +
    signals.burnoutProbability * 15;
  return Math.max(0, Math.min(100, Math.round(composite)));
}
