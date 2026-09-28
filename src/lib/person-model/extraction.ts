/** Person model extraction — Qwen reads caregiver input for lived experience.
 *
 * Boundary: this layer extracts what the person *said* or what family *reported*.
 * It never invents a value, goal, fear, or life story. Every entry carries its
 * source and confidence. When the input does not say something, the field is
 * absent — never filled in by assumption.
 */

export const PERSON_EXTRACTION_VERSION = "1.0.0";

export type ExtractedPersonValue = {
  text: string;
  source: "stated" | "inferred" | "family_reported";
  confidence: number;
  evidence: string;
};

export type ExtractedPersonGoal = {
  text: string;
  status: "active" | "achieved" | "abandoned" | "unclear";
  timeframe: string | null;
  source: "stated" | "inferred" | "family_reported";
  confidence: number;
  evidence: string;
};

export type ExtractedPersonFear = {
  text: string;
  severity: "low" | "medium" | "high";
  source: "stated" | "inferred" | "family_reported";
  evidence: string;
};

export type ExtractedGoodDay = {
  description: string;
  source: "stated" | "inferred" | "family_reported";
  confidence: number;
  evidence: string;
};

export type ExtractedLifeStory = {
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
  timeContext: string | null;
  source: "stated" | "inferred" | "family_reported";
  evidence: string;
};

export type ExtractedRelationship = {
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
  notes: string | null;
  source: "stated" | "inferred" | "family_reported";
  evidence: string;
};

export type ExtractedCognitivePattern = {
  pattern: string;
  kind: "trigger" | "calmer" | "peak_time" | "trough_time" | "routine_anchor";
  timeContext: string | null;
  evidence: string;
  confidence: number;
};

export type PersonExtractionResult = {
  version: string;
  values: ExtractedPersonValue[];
  goals: ExtractedPersonGoal[];
  fears: ExtractedPersonFear[];
  goodDayDefinitions: ExtractedGoodDay[];
  lifeStory: ExtractedLifeStory[];
  relationships: ExtractedRelationship[];
  cognitivePatterns: ExtractedCognitivePattern[];
  extractionConfidence: number;
  source: "llm" | "rules" | "llm+rules";
  degraded: boolean;
  rawResponse: string;
  model: string;
  durationMs: number;
};
