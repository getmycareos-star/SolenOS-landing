/**
 * Good care model — what matters for this person, trade-offs, enoughness.
 *
 * The system optimizes for: reduce uncertainty, preserve context, reduce
 * caregiver burden, improve decisions. This layer adds the missing piece:
 * what outcomes are *actually* good for this specific person, what trade-offs
 * they would make, and when to stop asking questions and just be present.
 */

export const GOOD_CARE_VERSION = "1.0.0";

export type CarePriority = {
  id: string;
  domain: string;
  description: string;
  whyItMatters: string;
  whatWouldMakeItWorse: string;
  source: "stated" | "inferred" | "family_reported";
  confidence: number;
  recordedAt: string;
};

export type CareTradeoff = {
  id: string;
  optionA: string;
  optionB: string;
  personWouldPrefer: "a" | "b" | "either" | "unknown";
  reasoning: string;
  source: "stated" | "inferred" | "family_reported";
  confidence: number;
  recordedAt: string;
};

export type EnoughnessRule = {
  id: string;
  domain: string;
  description: string;
  whenToStop: string;
  whenToKeepGoing: string;
  source: "stated" | "inferred" | "family_reported";
  confidence: number;
  recordedAt: string;
};

export type GoodCareModel = {
  version: string;
  careRecipientId: string;
  priorities: CarePriority[];
  tradeoffs: CareTradeoff[];
  enoughnessRules: EnoughnessRule[];
  createdAt: string;
  updatedAt: string;
};

export function createEmptyGoodCare(careRecipientId: string, createdAt?: string): GoodCareModel {
  const now = createdAt ?? new Date().toISOString();
  return {
    version: GOOD_CARE_VERSION,
    careRecipientId,
    priorities: [],
    tradeoffs: [],
    enoughnessRules: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function summarizeGoodCare(model: GoodCareModel): {
  priorityCount: number;
  tradeoffCount: number;
  enoughnessCount: number;
  hasStatedPriorities: boolean;
  hasStatedTradeoffs: boolean;
} {
  return {
    priorityCount: model.priorities.length,
    tradeoffCount: model.tradeoffs.length,
    enoughnessCount: model.enoughnessRules.length,
    hasStatedPriorities: model.priorities.some((p) => p.source === "stated"),
    hasStatedTradeoffs: model.tradeoffs.some((t) => t.source === "stated"),
  };
}