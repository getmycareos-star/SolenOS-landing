import type { HUMAN_CONFIDENCE_LABELS, LIVING_CARE_RECORD_EXPANDABLE } from "./contract-constants";
import type { CareEventKind } from "./event-clarifiers";
import type { SituationRelation, UnderstandingStage } from "../active-care-situation/types";
import type {
  CareRealityDisclosureStage,
  ResponseEvolutionEvaluation,
} from "../care-reality-state/types";
import type { DisclosurePlan } from "../care-reality-state/disclosure";
import type { ResponseRiskLevel } from "../response-intelligence";

export type HumanConfidenceLabel = (typeof HUMAN_CONFIDENCE_LABELS)[number];

export type ExpandableSectionId = (typeof LIVING_CARE_RECORD_EXPANDABLE)[number];

export type CareEventAddedBlock = {
  title: string;
  confirmation: string;
  date: string | null;
  event: string;
  related_care: string[];
  status: string;
  source: "text" | "document";
};

export type LivingCareRecordResponseView = {
  identity_line: string;
  /** Situation-grounded recognition — section 1 of response intelligence upgrade. */
  recognition_line: string | null;
  /** Continuity relation for this turn */
  relation: SituationRelation;
  understanding_stage: UnderstandingStage;
  care_event_added: CareEventAddedBlock;
  understanding_heading: string;
  what_understood: string[];
  insufficiency_note: string | null;
  connection_note: string | null;
  what_needs_context: string[];
  what_will_be_remembered: string[];
  /** Only when enough evidence exists */
  what_seems_happening: string | null;
  what_matters_now: string | null;
  /** Clarity pillars — site promise. */
  what_can_wait: string | null;
  what_may_become_serious: string | null;
  show_attention_sections: boolean;
  /** What changed in understanding since the last update — core product question. */
  what_changed_in_understanding: string | null;
  /** What SolenOS preserves for ongoing care continuity — section 6. */
  care_story_update: string | null;
  understanding_effect: string;
  pattern_label: string | null;
  confidence_label: HumanConfidenceLabel;
  /**
   * Response Contract risk_level — engine enum, never shown raw in UI.
   * Caregiver sees attention_label instead (no scores/%).
   */
  risk_level: ResponseRiskLevel;
  /** Human attention from risk_level — Low/Medium/High without score theater. */
  attention_label: string | null;
  event_kind: CareEventKind;
  original_input: string;
  has_documents: boolean;
  observation_count: number;
  expandable: Partial<Record<ExpandableSectionId, string[]>>;
  /** Progressive disclosure — reveal only what helps now (P0-10). */
  disclosure_stage: CareRealityDisclosureStage;
  disclosure_plan: DisclosurePlan;
  response_evolution: ResponseEvolutionEvaluation;
  primary_screen_question: string;
  care_reality_state_id: string | null;
  /** Quiet why-asking (L1) — optional / collapsed in UI. */
  why_asking: string | null;
  /** Source / supporting evidence line by maturity. */
  evidence_line: string | null;
  /** Consequence tier for evidence visibility (1|2|3|5|10). */
  evidence_maturity: 1 | 2 | 3 | 5 | 10;
  follow_up_items: string[];
};
