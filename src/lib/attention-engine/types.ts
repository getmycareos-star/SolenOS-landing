/** Class A/B/C — Situation Priority Contract attention classification. */
export type AttentionClass = "A" | "B" | "C";

/** Decision Surface priority — maps from AttentionClass. */
export type AttentionPriority = "Now" | "Watch" | "Later";

export type BurnoutTier = "Low" | "Moderate" | "High" | "Critical";

export type AttentionClassification = {
  attentionClass: AttentionClass;
  attentionPriority: AttentionPriority;
  label: string;
  reasoning: string;
  /** 0–1 confidence in the assigned class */
  confidence: number;
  classAScore: number;
  classBScore: number;
  classCScore: number;
  dominantLoadCategory?:
    | "repetition"
    | "sleep"
    | "emotional"
    | "uncertainty"
    | "dependency"
    | null;
};

export type AttentionLayerPayload = {
  attentionClass: AttentionClass;
  attentionPriority: AttentionPriority;
  label: string;
  reasoning: string;
  confidence: number;
  burnoutTier: BurnoutTier;
  dominantLoadCategory: AttentionClassification["dominantLoadCategory"];
};
