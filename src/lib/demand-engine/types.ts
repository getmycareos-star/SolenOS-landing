import type { DEMAND_CATEGORIES, DEMAND_STATUSES } from "./contract-constants";

export type DemandStatus = (typeof DEMAND_STATUSES)[number];

export type DemandCategory = (typeof DEMAND_CATEGORIES)[number];

/**
 * STATE action object attached to a Situation.
 * pressureScore is recomputed (derived) — may be stored as cache on the object
 * but is never an independent persistence system.
 */
export type Demand = {
  id: string;
  situationId: string;
  title: string;
  description: string;
  category: DemandCategory;
  status: DemandStatus;
  /** 0–100 */
  urgency: number;
  /** 0–100 */
  riskImpact: number;
  /** 0–100 — does NOT increase priority */
  effort: number;
  /** 0–100 */
  emotionalLoad: number;
  /** 0–100 */
  uncertainty: number;
  /** Derived: urgency*0.35 + riskImpact*0.35 + uncertainty*0.20 + emotionalLoad*0.10 */
  pressureScore: number;
  ownerId?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
};

export type DemandGenerationSeed = {
  situationId: string;
  title: string;
  summary?: string;
  /** Care-context / heuristic situation type when available. */
  situationType?: string;
  urgencyHint?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  /** Belief/missing-info uncertainty 0–100. */
  beliefUncertainty?: number;
};

export type DemandEngineOutput = {
  activeDemands: readonly Demand[];
  /** All demands including completed/cancelled for history. */
  allDemands: readonly Demand[];
  pressureScores: readonly { demandId: string; pressureScore: number }[];
  unresolvedCount: number;
  /** Soft estimate before CLI — active count * mean pressure / 10. */
  caregiverLoadEstimate: number;
};

export type DemandEngineGuaranteeResult = {
  ok: boolean;
  violations: string[];
};

export type DemandEngineLayerPayload = {
  activeCount: number;
  unresolvedCount: number;
  topDemandIds: readonly string[];
  topPressureScores: readonly number[];
  caregiverLoadEstimate: number;
  guaranteeOk: boolean;
};

export type DemandEngineLayerResult = {
  output: DemandEngineOutput;
  rankedActive: readonly Demand[];
  guarantee: DemandEngineGuaranteeResult;
};
