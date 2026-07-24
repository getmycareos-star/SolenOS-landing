import type {
  AHA_MOMENT_SECTIONS,
  MVP_NON_GOALS,
  MVP_SUCCESS_CRITERIA,
  MVP_SYSTEM_STATES,
  POST_ENTRY_PRIORITY_ORDER,
} from "./contract-constants";
import type { CanonicalCareEvent, SituationResponse, TrackingDimension } from "../situation-entry/types";

export type MvpSystemState = (typeof MVP_SYSTEM_STATES)[number];

export type AhaMomentSection = (typeof AHA_MOMENT_SECTIONS)[number];

export type AhaMomentView = {
  headline: string;
  sections: Record<
    AhaMomentSection,
    {
      title: string;
      items: string[];
    }
  >;
  events_extracted: number;
  is_first_value_moment: boolean;
};

export type PostEntryPriorityKind = (typeof POST_ENTRY_PRIORITY_ORDER)[number];

export type PrioritySurfaceItem = {
  kind: PostEntryPriorityKind;
  label: string;
  event_ids: string[];
};

export type SinceLastVisitDelta = {
  new_events: string[];
  updated_events: string[];
  resolved_uncertainties: string[];
  newly_emerged_risks: string[];
};

export type ContinuityHomeView = {
  system_state: "active_continuity";
  since_last_visit: SinceLastVisitDelta;
  needs_attention: {
    unresolved_questions: string[];
    pending_follow_ups: string[];
    missing_information: string[];
  };
  newly_important: PrioritySurfaceItem[];
  recent_events: Array<{ id: string; label: string; timestamp: string }>;
  recent_documents: Array<{ event_id: string; name: string; impact: string }>;
  upcoming_interactions: string[];
  reflection_prompt: string | null;
};

export type PostEntryBehavior = {
  mode: "integrate" | "compare" | "resolve" | "surface_impact";
  integration_summary: string;
  comparison_notes: string[];
  resolution_notes: string[];
  impact_summary: string;
  document_refinement: string | null;
  contradictions_surfaced: string[];
  correction_priority: boolean;
};

export type MvpSuccessCriteriaStatus = Record<
  (typeof MVP_SUCCESS_CRITERIA)[number],
  boolean
>;

export type MvpSurfaceAreaLayer = {
  system_state: MvpSystemState;
  first_screen_prompt: string;
  aha_moment: AhaMomentView | null;
  continuity_home: ContinuityHomeView | null;
  post_entry: PostEntryBehavior | null;
  priority_surface: PrioritySurfaceItem[];
  success_criteria: MvpSuccessCriteriaStatus;
  non_goals_suppressed: (typeof MVP_NON_GOALS)[number][];
  post_entry_definition: string;
};

export type ProcessMvpSurfaceInput = {
  caregiver_id: string;
  response: Omit<SituationResponse, "mvp_surface_area_layer" | "final_output">;
  is_return_session?: boolean;
};

export type { CanonicalCareEvent, TrackingDimension };
