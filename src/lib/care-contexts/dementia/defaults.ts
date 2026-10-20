import type { DementiaContext } from "./types";

export const DEFAULT_DEMENTIA_CONTEXT: DementiaContext = {
  dementia_stage: "unspecified",
  wandering_events: [],
  medication_risk: "independent",
  driving_status: "not_applicable",
  driving_status_history: [],
  possible_financial_risk_events: [],
};
