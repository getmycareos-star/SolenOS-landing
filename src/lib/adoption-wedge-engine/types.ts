import type { ADOPTION_WEDGE_RULES, ADOPTION_WEDGE_SECTIONS } from "./contract-constants";

export type AdoptionWedgeSectionKey = (typeof ADOPTION_WEDGE_SECTIONS)[number];

export type AdoptionWedgeSections = Record<AdoptionWedgeSectionKey, string[]>;

export type AdoptionWedgeResult = {
  active: boolean;
  is_first_value: boolean;
  ingestion_ready: boolean;
  sections: AdoptionWedgeSections;
  accepted_input_types: readonly string[];
  events_extracted: number;
  medications_detected: string[];
  symptoms_detected: string[];
  tasks_surfaced: number;
  alerts_surfaced: number;
  rules_upheld: readonly (typeof ADOPTION_WEDGE_RULES)[number][];
  defining_principle: string;
};

export type ProcessAdoptionWedgeInput = {
  caregiver_id: string;
  is_first_situation: boolean;
  events_created_count: number;
  care_timeline?: import("../care-timeline-engine/types").CareTimelineEngineResult;
  current_state?: import("../current-state-view-engine/types").CurrentStateViewResult;
  tasks?: import("../task-extraction-engine/types").TaskExtractionResult;
  entry_mode?: import("../entry-behavior-protocol/types").EntryMode;
};
