import type { CareProfile } from "../care-profile/types";
import type { SituationalCareContext } from "../care-context/situational/types";
import type { TrackedSituation } from "../resolution-engine/types";
import type { TimeEngineLayerResult } from "../time-engine/types";
import type { BaseRiskLevel, RiskCluster, SituationRisk } from "./types";

const RISK_RANK: Record<BaseRiskLevel, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3,
};

function maxRiskLevel(levels: readonly BaseRiskLevel[]): BaseRiskLevel {
  let best: BaseRiskLevel = "LOW";
  for (const level of levels) {
    if (RISK_RANK[level] > RISK_RANK[best]) best = level;
  }
  return best;
}

function overlapTokens(title: string): Set<string> {
  const tokens = title
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);
  return new Set(tokens);
}

function sharesInsuranceLanguage(a: string, b: string): boolean {
  const pattern =
    /\b(insurance|prior\s*auth|authorization|coverage|claim|benefits?|medicaid|medicare)\b/i;
  return pattern.test(a) && pattern.test(b);
}

function sharesMedicalLanguage(a: string, b: string): boolean {
  const pattern =
    /\b(medication|dose|hospital|clinic|doctor|physician|lab|appointment|medical|discharge)\b/i;
  return pattern.test(a) && pattern.test(b);
}

function sameTimeWindow(
  timeEngine?: TimeEngineLayerResult,
  careContext?: SituationalCareContext,
): boolean {
  const horizon = timeEngine?.prioritySignal.activeHorizon;
  if (horizon === "NOW" || horizon === "TODAY") return true;
  const pressure = careContext?.environmentSignals.timePressure;
  return pressure === "high" || pressure === "medium";
}

/**
 * Cluster ACTIVE situations by shared dependent, time window,
 * medical dependency, or insurance dependency overlap.
 */
export function buildRiskClusters(params: {
  activeSituations: readonly TrackedSituation[];
  situationRisks: readonly SituationRisk[];
  careProfile?: CareProfile;
  careContext?: SituationalCareContext;
  timeEngine?: TimeEngineLayerResult;
}): RiskCluster[] {
  const byId = new Map(params.situationRisks.map((r) => [r.situationId, r]));
  const situations = params.activeSituations;
  if (situations.length === 0) return [];

  const assigned = new Set<string>();
  const clusters: RiskCluster[] = [];

  const dependents = params.careProfile?.careRelationships.dependents ?? [];
  if (dependents.length > 0 && situations.length > 1) {
    const ids = situations.map((s) => s.id);
    clusters.push({
      situations: ids,
      clusterRiskLevel: maxRiskLevel(
        ids.map((id) => byId.get(id)?.baseRisk ?? "LOW"),
      ),
      clusterKind: "same_dependent",
    });
    for (const id of ids) assigned.add(id);
  }

  // Pairwise medical / insurance / time-window clusters for unassigned pairs.
  for (let i = 0; i < situations.length; i++) {
    for (let j = i + 1; j < situations.length; j++) {
      const a = situations[i]!;
      const b = situations[j]!;
      if (assigned.has(a.id) && assigned.has(b.id)) continue;

      let kind: RiskCluster["clusterKind"] | null = null;
      if (sharesInsuranceLanguage(a.title, b.title)) {
        kind = "insurance_dependency_overlap";
      } else if (
        sharesMedicalLanguage(a.title, b.title) ||
        a.unresolvedDependencyIds.some((d) => b.unresolvedDependencyIds.includes(d))
      ) {
        kind = "shared_medical_dependency";
      } else if (sameTimeWindow(params.timeEngine, params.careContext)) {
        const tokensA = overlapTokens(a.title);
        const tokensB = overlapTokens(b.title);
        let shared = 0;
        for (const t of tokensA) if (tokensB.has(t)) shared += 1;
        if (shared >= 1) kind = "same_time_window";
      }

      if (!kind) continue;
      const ids = [a.id, b.id];
      clusters.push({
        situations: ids,
        clusterRiskLevel: maxRiskLevel(
          ids.map((id) => byId.get(id)?.baseRisk ?? "LOW"),
        ),
        clusterKind: kind,
      });
      for (const id of ids) assigned.add(id);
    }
  }

  // High-risk overlap cluster — multiple HIGH/CRITICAL.
  const highCritical = params.situationRisks.filter(
    (r) => r.baseRisk === "HIGH" || r.baseRisk === "CRITICAL",
  );
  if (highCritical.length >= 2) {
    const ids = highCritical.map((r) => r.situationId);
    const already = clusters.some(
      (c) =>
        c.clusterKind === "high_risk_overlap" ||
        (c.situations.length === ids.length &&
          ids.every((id) => c.situations.includes(id))),
    );
    if (!already) {
      clusters.push({
        situations: ids,
        clusterRiskLevel: maxRiskLevel(highCritical.map((r) => r.baseRisk)),
        clusterKind: "high_risk_overlap",
      });
      for (const id of ids) assigned.add(id);
    }
  }

  for (const s of situations) {
    if (assigned.has(s.id)) continue;
    clusters.push({
      situations: [s.id],
      clusterRiskLevel: byId.get(s.id)?.baseRisk ?? "LOW",
      clusterKind: "singleton",
    });
  }

  return clusters;
}

export function selectDominantRiskCluster(
  clusters: readonly RiskCluster[],
  situationRisks: readonly SituationRisk[],
): string[] {
  if (clusters.length === 0) return [];
  const riskById = new Map(situationRisks.map((r) => [r.situationId, r.adjustedRisk]));

  let best = clusters[0]!;
  let bestScore = -1;
  for (const cluster of clusters) {
    const riskSum = cluster.situations.reduce(
      (sum, id) => sum + (riskById.get(id) ?? 0),
      0,
    );
    const levelBoost = RISK_RANK[cluster.clusterRiskLevel] * 20;
    const score = riskSum + levelBoost + cluster.situations.length * 5;
    if (score > bestScore) {
      bestScore = score;
      best = cluster;
    }
  }
  return [...best.situations];
}
