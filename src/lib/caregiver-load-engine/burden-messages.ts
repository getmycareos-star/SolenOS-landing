import type { LoadScores } from "./types";
import type { DependencyStage } from "./dementia-context";

export type BuildBurdenMessagesParams = {
  scores: LoadScores;
  burnoutProbability: number;
  burnoutTrend: "stable" | "rising" | "critical";
  dependencyStage: DependencyStage;
  primaryContributors: readonly string[];
};

/**
 * Record-based load notes for internal/ops surfaces — never invent emotional certainty,
 * never emit burnout risk % or CareLoad scores (CRI + emotional-language safety).
 */
export function buildBurdenMessages(params: BuildBurdenMessagesParams): string[] {
  const statements: string[] = [];
  void params.burnoutProbability;
  void params.burnoutTrend;
  void params.dependencyStage;

  if (params.scores.sleepRiskScore >= 40) {
    statements.push(
      params.scores.sleepRiskScore >= 65
        ? "Sleep disruption is showing up in what you shared."
        : "Sleep notes are part of what is held.",
    );
  }

  if (params.scores.uncertaintyIndex >= 0.35) {
    statements.push(
      "Open uncertainties in the care record are part of what is being held.",
    );
  }

  if (params.scores.dependencyLoadScore >= 35) {
    statements.push(
      "Growing care needs are reflected in the Living Care Record.",
    );
  }

  if (statements.length === 0 && params.primaryContributors.length > 0) {
    statements.push(
      `Held from what you shared: ${params.primaryContributors.slice(0, 2).join("; ")}.`,
    );
  }

  if (statements.length === 0) {
    statements.push("What you shared is held in the Living Care Record.");
  }

  return statements;
}

export function buildBurdenSummary(statements: readonly string[]): string {
  return statements.slice(0, 3).join(" ");
}

export function buildPrimaryContributors(scores: LoadScores): string[] {
  const entries: [string, number][] = [
    ["verbal conflict and emotional strain", scores.emotionalLoadScore],
    ["sleep disruption", scores.sleepRiskScore],
    ["open uncertainties", scores.uncertaintyIndex * 100],
    ["repeated care demands", scores.cognitiveLoadScore],
    ["increasing care needs", scores.dependencyLoadScore],
  ];
  return entries
    .filter(([, score]) => score >= 35)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([label]) => label);
}
