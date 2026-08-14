import type {
  ActiveCareSituation,
  SituationObservation,
  SituationRelation,
  UnderstandingStage,
} from "../active-care-situation/types";
import type { CareEventKind } from "../living-care-record-ux/event-clarifiers";
import type { ProgressiveUnderstandingEffect } from "./contract-constants";

export type { ProgressiveUnderstandingEffect };

export type ObservationSignal =
  | "frustration"
  | "sadness"
  | "go_home"
  | "confusion"
  | "agitation"
  | "appetite"
  | "fall"
  | "medication"
  | "discharge"
  | "appointment"
  | "document"
  | "improvement"
  | "general";

export type ProgressiveUnderstandingInput = {
  prior: ActiveCareSituation | null;
  relation: SituationRelation;
  observation: SituationObservation;
  kind: CareEventKind;
  rawText: string;
  /** Draft situation after observation appended (or opened). */
  draft: ActiveCareSituation;
};

export type ProgressiveUnderstandingResult = {
  understanding_stage: UnderstandingStage;
  theme: ActiveCareSituation["theme"];
  /** New caregiver-facing asks this turn only — never re-surfaces prior unanswered gaps. */
  open_questions: string[];
  /** Persist on ACS/CRS: remaining known-unknowns plus this turn's new asks. */
  known_unknowns: string[];
  asked_questions: string[];
  resolved_uncertainties: string[];
  connection_note: string | null;
  synthesis: string | null;
  what_matters_now: string | null;
  /** Accumulated caregiver-facing understanding lines (evolving, not restart). */
  current_understanding: string[];
  understanding_heading: string;
  confirmation_title: string;
  confirmation_body: string;
  insufficiency_note: string | null;
  what_will_be_remembered: string[];
  show_attention_sections: boolean;
  /** Core product answer: what changed in understanding since last update. */
  what_changed_in_understanding: string | null;
  effect: ProgressiveUnderstandingEffect;
  signals_present: ObservationSignal[];
  pattern_label: string | null;
  what_can_wait: string | null;
  what_may_become_serious: string | null;
  compound_signal: string | null;
  trajectory_by_domain: Record<string, "worsening" | "improving" | "stable" | "unknown">;
  cross_signal_correlations: Array<{
    signal_a: string;
    signal_b: string;
    correlation: "correlated" | "inverse" | "independent" | "unknown";
  }>;
};
