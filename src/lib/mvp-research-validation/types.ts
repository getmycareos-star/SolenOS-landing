export type AttentionLane =
  | "care_monitoring"
  | "administrative"
  | "upcoming"
  | "uncertain";

export type AttentionSituation = {
  lane: AttentionLane;
  /** Caregiver-facing status — not a task verb. */
  status: string;
  excerpt: string;
};

export type CompetingAttentionResult = {
  is_competing: boolean;
  situations: AttentionSituation[];
  /** Plain-language prioritization — never a checklist title. */
  orientation: string | null;
};

export type ResearchValidationFeatureEvaluation = {
  feature_description: string;
  verdict: "pass" | "reject" | "unclear_rejected";
  reduces_cognitive_load: boolean | null;
  reason: string;
};
