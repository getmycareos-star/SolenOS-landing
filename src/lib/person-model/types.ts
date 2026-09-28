/**
 * Person model — lived experience, values, goals, life story, relationship web.
 *
 * Every field is optional and every entry carries its source and confidence.
 * Nothing is invented: a value the person never stated and no family member
 * ever reported is not in the model. The model grows only from what was said.
 */

export const PERSON_MODEL_VERSION = "1.0.0";

/** A person's stated or inferred value — what they care about. */
export type PersonValue = {
  id: string;
  text: string;
  source: "stated" | "inferred" | "family_reported";
  confidence: number;
  recordedAt: string;
};

/** A goal — what the person wants to achieve or maintain. */
export type PersonGoal = {
  id: string;
  text: string;
  status: "active" | "achieved" | "abandoned" | "unclear";
  timeframe?: string | null;
  source: "stated" | "inferred" | "family_reported";
  confidence: number;
  recordedAt: string;
};

/** A fear — what the person is afraid of. */
export type PersonFear = {
  id: string;
  text: string;
  severity: "low" | "medium" | "high";
  source: "stated" | "inferred" | "family_reported";
  recordedAt: string;
};

/** What a "good day" looks like to this person. */
export type GoodDayDefinition = {
  id: string;
  description: string;
  source: "stated" | "inferred" | "family_reported";
  confidence: number;
  recordedAt: string;
};

/** A life story element — what the person did, who they were. */
export type LifeStoryElement = {
  id: string;
  category:
    | "work"
    | "family"
    | "hobby"
    | "travel"
    | "achievement"
    | "loss"
    | "role"
    | "other";
  text: string;
  timeContext?: string | null;
  source: "stated" | "inferred" | "family_reported";
  recordedAt: string;
};

/** A relationship — who matters to the person. */
export type Relationship = {
  id: string;
  personName: string;
  relationship: string;
  role: "family" | "friend" | "colleague" | "clinician" | "caregiver" | "other";
  closeness:
    | "very_close"
    | "close"
    | "acquaintance"
    | "distant"
    | "estranged"
    | "unknown";
  trustLevel: "high" | "medium" | "low" | "unknown";
  visitsOrContacts: boolean;
  notes?: string | null;
  source: "stated" | "inferred" | "family_reported";
  recordedAt: string;
};

/** Cognitive pattern — how cognition fluctuates. */
export type CognitivePattern = {
  id: string;
  pattern: string;
  kind: "trigger" | "calmer" | "peak_time" | "trough_time" | "routine_anchor";
  timeContext?: string | null;
  evidence: string;
  confidence: number;
  recordedAt: string;
};

/** The full person model. */
export type PersonModel = {
  version: string;
  careRecipientId: string;
  displayName: string;
  preferredName?: string | null;
  relationship?: string | null;
  lifeStory: LifeStoryElement[];
  values: PersonValue[];
  goals: PersonGoal[];
  fears: PersonFear[];
  goodDayDefinitions: GoodDayDefinition[];
  relationships: Relationship[];
  cognitivePatterns: CognitivePattern[];
  createdAt: string;
  updatedAt: string;
};

export type PersonModelSummary = {
  careRecipientId: string;
  displayName: string;
  preferredName?: string | null;
  valuesCount: number;
  goalsActive: number;
  fearsHigh: number;
  relationshipsCount: number;
  cognitivePatternsCount: number;
  lifeStoryCount: number;
  hasStatedValues: boolean;
  hasStatedGoals: boolean;
  hasStatedFears: boolean;
  hasStatedGoodDay: boolean;
  updatedAt: string;
};

export function createEmptyPersonModel(params: {
  careRecipientId: string;
  displayName: string;
  preferredName?: string | null;
  relationship?: string | null;
  createdAt?: string;
}): PersonModel {
  const now = params.createdAt ?? new Date().toISOString();
  return {
    version: PERSON_MODEL_VERSION,
    careRecipientId: params.careRecipientId,
    displayName: params.displayName,
    preferredName: params.preferredName ?? params.displayName,
    relationship: params.relationship ?? null,
    lifeStory: [],
    values: [],
    goals: [],
    fears: [],
    goodDayDefinitions: [],
    relationships: [],
    cognitivePatterns: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function summarizePersonModel(model: PersonModel): PersonModelSummary {
  return {
    careRecipientId: model.careRecipientId,
    displayName: model.displayName,
    preferredName: model.preferredName ?? null,
    valuesCount: model.values.length,
    goalsActive: model.goals.filter((g) => g.status === "active").length,
    fearsHigh: model.fears.filter((f) => f.severity === "high").length,
    relationshipsCount: model.relationships.length,
    cognitivePatternsCount: model.cognitivePatterns.length,
    lifeStoryCount: model.lifeStory.length,
    hasStatedValues: model.values.some((v) => v.source === "stated"),
    hasStatedGoals: model.goals.some((g) => g.source === "stated"),
    hasStatedFears: model.fears.some((f) => f.source === "stated"),
    hasStatedGoodDay: model.goodDayDefinitions.some((g) => g.source === "stated"),
    updatedAt: model.updatedAt,
  };
}