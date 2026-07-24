export type ContextWeight = {
  recency: number;
  relevance: number;
  reliability: number;
};

export type ContextWeightSource =
  | "memory"
  | "document"
  | "user_input"
  | "assumption"
  | "care_context";

export type WeightedContextItem = {
  id: string;
  source: ContextWeightSource;
  label: string;
  weights: ContextWeight;
  /** Composite 0–1 used by orchestration — not a fact score. */
  composite: number;
};

export type ContextWeightingResult = {
  items: readonly WeightedContextItem[];
  meanComposite: number;
};
