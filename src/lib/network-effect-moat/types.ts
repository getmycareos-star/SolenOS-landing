import type {
  COMPOUNDING_ASSET_TYPES,
  ENRICHMENT_ACTION_TYPES,
  INTERACTION_OUTCOME_TYPES,
  MATURITY_STAGES,
  NON_COMPOUNDING_TYPES,
} from "./contract-constants";

export type CompoundingAssetType = (typeof COMPOUNDING_ASSET_TYPES)[number];
export type NonCompoundingType = (typeof NON_COMPOUNDING_TYPES)[number];
export type InteractionOutcomeType = (typeof INTERACTION_OUTCOME_TYPES)[number];
export type EnrichmentActionType = (typeof ENRICHMENT_ACTION_TYPES)[number];
export type MaturityStage = (typeof MATURITY_STAGES)[number];

export type EntityMatch = {
  entity_label: string;
  entity_kind: string;
  matched_event_ids: string[];
  match_confidence: number;
  is_new: boolean;
};

export type EventMatch = {
  new_event_id: string;
  existing_event_id: string;
  match_reason: string;
  match_confidence: number;
};

export type ResolvedUncertainty = {
  id: string;
  question: string;
  resolution: string;
  resolved_by_event_id: string;
  resolved_at: string;
};

export type EnrichmentAction = {
  id: string;
  action_type: EnrichmentActionType;
  description: string;
  target_event_id: string | null;
  source_event_id: string | null;
  created_at: string;
};

export type InteractionOutcome = {
  outcome_type: InteractionOutcomeType;
  description: string;
  event_id: string | null;
  created_at: string;
};

export type CompoundingMetrics = {
  total_events: number;
  total_relationships: number;
  total_entities: number;
  correction_count: number;
  resolved_uncertainty_count: number;
  days_of_continuity: number;
  linked_documents: number;
  open_follow_ups: number;
  closed_follow_ups: number;
};

export type MoatStrength = {
  score: number;
  level: "emerging" | "growing" | "strong" | "irreplaceable";
  reason: string;
  irreversibility_factors: string[];
};

export type NetworkEffectMoatResult = {
  interaction_outcomes: InteractionOutcome[];
  enrichment_actions: EnrichmentAction[];
  entity_matches: EntityMatch[];
  event_matches: EventMatch[];
  resolved_uncertainties: ResolvedUncertainty[];
  new_relationships: number;
  compounding_metrics: CompoundingMetrics;
  moat_strength: MoatStrength;
  maturity_stage: MaturityStage;
  maturity_message: string;
  context_grew: boolean;
  isolated_records: number;
};

export type MoatStore = {
  caregiver_id: string;
  resolved_uncertainties: ResolvedUncertainty[];
  enrichment_history: EnrichmentAction[];
  cumulative_corrections: number;
  first_event_at: string | null;
  updated_at: string;
};
