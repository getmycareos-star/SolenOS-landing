import type { CareEventKind } from "../living-care-record-ux/event-clarifiers";
import type { ProgressiveUnderstandingEffect } from "../progressive-understanding/contract-constants";
import type {
  CareRealityDisclosureStage,
  ResponseEvolutionEvaluation,
} from "../care-reality-state/types";
import type { DisclosurePlan } from "../care-reality-state/disclosure";

export type SituationRelation =
  | "opens_new"
  | "updates_active"
  | "adds_context"
  | "answers_uncertainty";

export type UnderstandingStage = "gathering" | "forming" | "synthesizing";

export type SituationObservation = {
  id: string;
  raw_text: string;
  human_fact: string;
  kind: CareEventKind;
  captured_at: string;
  event_ids: string[];
  /** Epistemic kind — interpretation must not be promoted as settled fact (G37). */
  epistemic_kind?: "caregiver_interpretation" | "observable_observation" | "baseline_establishment" | "mixed";
  /** G3 — who contributed this observation (same Care Reality). */
  contributor_id?: string | null;
  /** When caregiver explicitly corrected this observation — prior kept as evidence. */
  disputed_by_correction_id?: string | null;
  /** Observation id this note explicitly corrects. */
  corrects_observation_id?: string | null;
};

export type ActiveCareSituation = {
  id: string;
  /**
   * Care Reality scope (Locked B) — one Living Care Record per care recipient.
   * Durable ACS files are keyed by this id.
   */
  care_recipient_id?: string;
  /** Last / opening contributor on this Care Reality (attribution, not ownership). */
  caregiver_id: string;
  opened_at: string;
  updated_at: string;
  /** First CareEvent id of this evolving situation (durable spine root). */
  root_event_id: string | null;
  subject_label: string;
  theme: "emotional_behavior" | "incident" | "care_change" | "mixed";
  observations: SituationObservation[];
  open_questions: string[];
  asked_questions: string[];
  understanding_stage: UnderstandingStage;
  connection_note: string | null;
  synthesis: string | null;
  what_matters_now: string | null;
  /**
   * Done for now pauses the interaction session only.
   * ACS + CRS remain durable; engine owns lifecycle (Active/Quiet/…).
   */
  interaction_paused_at?: string | null;
  /** Evidence-driven lifecycle — never set by Done for now (session pause uses interaction_paused_at only). */
  lifecycle_status?: "active" | "quiet" | "resolved" | "historical";
  /** Last progressive effect applied (durable for continuity). */
  last_understanding_effect?: ProgressiveUnderstandingEffect | null;
  /** Last understanding delta shown to caregiver. */
  last_understanding_delta?: string | null;
  pattern_label?: string | null;
  /** Person familiarity baseline statements (G34) — not population dementia. */
  familiarity_baseline?: string[];
};

export type ActiveSituationTurn = {
  relation: SituationRelation;
  situation: ActiveCareSituation;
  confirmation_title: string;
  confirmation_body: string;
  understanding_heading: string;
  understanding_stage: UnderstandingStage;
  current_understanding: string[];
  insufficiency_note: string | null;
  connection_note: string | null;
  what_needs_context: string[];
  what_will_be_remembered: string[];
  what_seems_happening: string | null;
  what_matters_now: string | null;
  show_attention_sections: boolean;
  /** Core product: what changed in understanding since last update. */
  what_changed_in_understanding: string | null;
  understanding_effect: ProgressiveUnderstandingEffect;
  resolved_uncertainties: string[];
  pattern_label: string | null;
  /** Clarity pillars — What matters / What can wait / What may become serious. */
  what_can_wait: string | null;
  what_may_become_serious: string | null;
  /** Care Reality State id — caregiver responses project from CRS, not latest message alone. */
  care_reality_state_id: string | null;
  /** CRS observation_count — evidence maturity source of truth. */
  crs_observation_count: number;
  /** CRS revision — how many times understanding has evolved. */
  crs_revision: number;
  /** SRE identity_mismatch — incoming note may refer to a different care recipient (G17). */
  identity_mismatch?: boolean;
/** Continuity hooks for future captures to reconnect to this care reality. */
  continuity_hooks?: string[];
  /** Raw note held for clarification when identity_mismatch — not yet on ACS timeline. */
  identity_mismatch_input?: string | null;
  /** Caregiver explicitly corrected prior held understanding (Phase 12). */
  memory_correction_applied?: boolean;
  disclosure_stage: CareRealityDisclosureStage;
  disclosure_plan: DisclosurePlan;
  response_evolution: ResponseEvolutionEvaluation;
  primary_screen_question: string;
};
