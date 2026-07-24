import type {
  DementiaStage,
  DrivingStatus,
  MedicationRiskLevel,
  SundowningWindow,
} from "./types";

export const SUNDOWNING_WARNING =
  "High-stress conversations may be harder during this period.";

export const DEMENTIA_STAGE_LABELS: Record<DementiaStage, string> = {
  early: "Early stage",
  moderate: "Moderate stage",
  late: "Late stage",
  unspecified: "Unspecified",
};

export const MEDICATION_RISK_LABELS: Record<MedicationRiskLevel, string> = {
  independent: "Independent",
  needs_supervision: "Needs supervision",
  needs_full_administration: "Needs full administration",
};

export const DRIVING_STATUS_LABELS: Record<DrivingStatus, string> = {
  still_driving: "Still driving",
  recently_stopped: "Recently stopped",
  conversation_pending: "Conversation pending",
  not_applicable: "Not applicable",
};

export function formatSundowningWindow(window: SundowningWindow): string {
  return `${window.start} – ${window.end}`;
}
