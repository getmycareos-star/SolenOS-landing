import type {
  ASSUMPTION_SOURCES,
  ASSUMPTION_STATUSES,
} from "./contract-constants";

export type AssumptionStatus = (typeof ASSUMPTION_STATUSES)[number];

export type AssumptionSource = (typeof ASSUMPTION_SOURCES)[number];

export type Assumption = {
  assumptionId: string;
  statement: string;
  relatedSituationId?: string;
  source: AssumptionSource;
  status: AssumptionStatus;
  createdAt: string;
  lastCheckedAt?: string;
  confidence: number;
};

export type AssumptionRegistryPolicy = {
  expirationDays: number;
  staleDays: number;
};

export type AssumptionRegistryState = {
  userId: string;
  assumptions: Assumption[];
  policy: AssumptionRegistryPolicy;
};

export type AssumptionHealth = {
  activeAssumptions: number;
  expiredAssumptions: number;
  invalidatedAssumptions: number;
  staleAssumptions: number;
};

export type AssumptionInfluenceEnvelope = {
  /** Soft bias [0,1] — never treated as facts. */
  compositeBias: number;
  /** Count of assumptions currently influencing decisions. */
  influenceableCount: number;
  /** Summaries for UI — not raw statements as LLM facts. */
  influenceHints: readonly string[];
  /** Stale influenceable assumptions reduce trust in bias strength. */
  staleInfluenceCount: number;
  health: AssumptionHealth;
};

export type AssumptionInvalidationEvent = {
  assumptionId: string;
  reason: string;
  trigger: "user_input" | "document" | "resolution";
};

export type AssumptionRegistryGuaranteeResult = {
  ok: boolean;
  violations: string[];
};

export type AssumptionRegistryLayerResult = {
  state: AssumptionRegistryState;
  envelope: AssumptionInfluenceEnvelope;
  invalidations: readonly AssumptionInvalidationEvent[];
  expirations: readonly string[];
  guarantee: AssumptionRegistryGuaranteeResult;
};

export type AssumptionRegistryLayerPayload = {
  influenceableCount: number;
  compositeBias: number;
  staleInfluenceCount: number;
  health: AssumptionHealth;
  influenceHints: readonly string[];
  recentInvalidations: readonly AssumptionInvalidationEvent[];
};
