/**
 * Deterministic Prioritization Engine — internal types.
 * Public compress output is exactly the 6-field Decision Snapshot.
 * Internal buckets (DO_FIRST / SAFE_TO_DELAY / WATCH_CLOSELY) NEVER appear in public JSON.
 */

export type ScoreDimension = 0 | 1 | 2 | 3;

export type PrioritySignal = "HIGH_IMPACT" | "NONE";

/** Internal compression classification — NEVER leak into public output. */
export type InternalPriorityBucket =
  | "DO_FIRST"
  | "SAFE_TO_DELAY"
  | "WATCH_CLOSELY";

export type RiskLevel = "low" | "medium" | "high";

/** STEP 1 — atomic issue; no ranking yet. */
export type Issue = {
  id: string;
  title: string;
  context: string;
};

export type DimensionScores = {
  safety: ScoreDimension;
  time: ScoreDimension;
  cost: ScoreDimension;
  reversibility: ScoreDimension;
  relief: ScoreDimension;
};

/**
 * PriorityScore = safety*3 + time*2 + cost*2 + reversibility*1 + relief*1
 * Max = 3*3 + 3*2 + 3*2 + 3*1 + 3*1 = 27
 */
export type ScoredIssue = Issue & {
  dimensions: DimensionScores;
  priorityScore: number;
  prioritySignal: PrioritySignal;
  uncertain: boolean;
};

/** REQUIRED — engine invalid if any field missing. */
export type IssueExplanation = {
  whyHere: string;
  whyNotHigher: string;
  whyNotLower: string;
};

export type RankedIssue = ScoredIssue & {
  rank: number;
  internalBucket: InternalPriorityBucket;
  explanation: IssueExplanation;
};

/** Public SolenOS Decision Snapshot — EXACTLY these 6 keys. */
export type DecisionSnapshot = {
  what_is_happening: string;
  what_matters_now: string;
  what_to_ask_next: string;
  risk_level: RiskLevel;
  what_can_wait: string;
  follow_up_items: string[];
};

export type DeterministicPrioritizationGuaranteeResult = {
  ok: boolean;
  violations: string[];
};

export type DeterministicPrioritizationLayerResult = {
  issues: readonly Issue[];
  ranked: readonly RankedIssue[];
  /** Public fixed schema — only these 6 fields. */
  snapshot: DecisionSnapshot;
  guarantee: DeterministicPrioritizationGuaranteeResult;
};

/** Debug/UI internals — never merge into primary SolenOS 5-field response. */
export type DeterministicPrioritizationLayerPayload = {
  issueCount: number;
  rankedTitles: readonly string[];
  prioritySignals: readonly PrioritySignal[];
  scores: readonly {
    id: string;
    title: string;
    priorityScore: number;
    prioritySignal: PrioritySignal;
    internalBucket: InternalPriorityBucket;
    dimensions: DimensionScores;
    explanation: IssueExplanation;
  }[];
  /** Full 6-field compression for observability / RESULT surfaces. */
  decision_snapshot: DecisionSnapshot;
  guaranteeOk: boolean;
};
