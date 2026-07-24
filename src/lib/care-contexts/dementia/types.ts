/** Dementia context V1 — storage and display only; no inference or prediction. */

import type { CareContextType } from "../types";

export const DEMENTIA_STAGES = ["early", "moderate", "late", "unspecified"] as const;
export type DementiaStage = (typeof DEMENTIA_STAGES)[number];

export const MEDICATION_RISK_LEVELS = [
  "independent",
  "needs_supervision",
  "needs_full_administration",
] as const;
export type MedicationRiskLevel = (typeof MEDICATION_RISK_LEVELS)[number];

export const DRIVING_STATUSES = [
  "still_driving",
  "recently_stopped",
  "conversation_pending",
  "not_applicable",
] as const;
export type DrivingStatus = (typeof DRIVING_STATUSES)[number];

export type WanderingEvent = {
  id: string;
  timestamp: string;
  description: string;
  trigger?: string;
  location?: string;
};

export type FinancialRiskEvent = {
  id: string;
  timestamp: string;
  description: string;
};

export type SundowningWindow = {
  start: string;
  end: string;
};

export type DrivingStatusHistoryEntry = {
  status: DrivingStatus;
  recorded_at: string;
};

export type DementiaContext = {
  dementia_stage: DementiaStage;
  wandering_events: WanderingEvent[];
  sundowning_window?: SundowningWindow;
  medication_risk: MedicationRiskLevel;
  driving_status: DrivingStatus;
  driving_status_history: DrivingStatusHistoryEntry[];
  possible_financial_risk_events: FinancialRiskEvent[];
};

/** API/view shape for dementia care-context profile (client-safe). */
export type DementiaProfileView = {
  id: string;
  care_context: CareContextType;
  dementia_context: DementiaContext | null;
  current_medications: string[];
};
