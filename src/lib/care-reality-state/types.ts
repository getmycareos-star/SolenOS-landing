import type {
  ActiveCareSituation,
  ActiveSituationTurn,
  SituationRelation,
  UnderstandingStage,
} from "../active-care-situation/types";
import type { ProgressiveUnderstandingEffect } from "../progressive-understanding/contract-constants";
import type { CARE_REALITY_DISCLOSURE_STAGES } from "./contract-constants";

export type CareRealityDisclosureStage =
  (typeof CARE_REALITY_DISCLOSURE_STAGES)[number];

/** Response Evolution evaluation — before any caregiver-facing copy. */
export type ResponseEvolutionEvaluation = {
  updates_active_situation: boolean;
  answers_previous_uncertainty: boolean;
  strengthens_existing_hypothesis: boolean;
  introduces_new_pattern: boolean;
  changes_what_matters_now: boolean;
  invalidates_previous_understanding: boolean;
};

export type CareRealityState = {
  id: string;
  /**
   * Care Reality scope (Locked B). Durable CRS files are keyed by this id.
   * Legacy field name `caregiver_id` may still hold the same value for older files
   * (reality key — not contributor attribution). Contributors are on ACS observations.
   */
  care_recipient_id?: string;
  /** @deprecated Prefer care_recipient_id. Legacy alias for Care Reality store key. */
  caregiver_id: string;
  care_recipient_label: string;
  updated_at: string;
  situation_id: string | null;
  root_event_id: string | null;
  understanding_stage: UnderstandingStage;
  disclosure_stage: CareRealityDisclosureStage;
  /** Current belief about care reality (evolving). */
  current_understanding: string[];
  /**
   * Supporting evidence for current understanding (engine shape).
   * UI reveals by evidence maturity — never dump raw processing.
   */
  supporting_evidence: Array<{
    source: "caregiver_note" | "document" | "related_observation";
    date: string;
    observation: string;
  }>;
  situation_summary: string | null;
  pattern_label: string | null;
  what_matters_now: string | null;
  open_uncertainties: string[];
  resolved_uncertainties: string[];
  what_changed_in_understanding: string | null;
  understanding_effect: ProgressiveUnderstandingEffect;
  response_evolution: ResponseEvolutionEvaluation;
  primary_screen_question: string;
  observation_count: number;
  revision: number;
/** Hooks for future captures to reconnect to this care reality. */
  continuity_hooks: string[];
  /** History of how understanding evolved (lifecycle). */
  understanding_revisions: Array<{
    at: string;
    disclosure_stage: CareRealityDisclosureStage;
    summary: string;
    effect: ProgressiveUnderstandingEffect;
  }>;
};

export type UpdateCareRealityStateInput = {
  caregiverId: string;
  turn: ActiveSituationTurn;
  situation: ActiveCareSituation;
  relation: SituationRelation;
  nowIso?: string;
  /** Phase 12 — explicit correction: keep prior as conflict evidence, update belief. */
  memory_correction?: {
    record_id: string;
    original_observation: string;
    corrected_value: string;
  };
};
