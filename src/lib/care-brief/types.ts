/**
 * Care Brief — a comprehensive living care context summary.
 *
 * Dementia Wedge use cases:
 * - New Caregiver Starts: "How do I explain everything?"
 *   SolenOS role: Generate care context so knowledge is transferred
 *   without relying on memory or verbal explanations.
 *
 * - Doctor Appointment: "I don't want to forget something important."
 *   SolenOS role: Create a care brief that summarizes changes, patterns,
 *   history, and questions worth discussing.
 *
 * - Hospital Discharge: "What do we do now?"
 *   SolenOS role: Provide transition intelligence by organizing discharge
 *   information into relevant context and next steps.
 */

import type { ChangeReport } from "../change-report/types";

/**
 * A living care context section — structured for quick comprehension.
 */
export type CareBriefSection = {
  title: string;
  items: string[];
};

/**
 * The complete care brief — designed for knowledge transfer and decision readiness.
 */
export type CareBrief = {
  /** The care recipient */
  care_recipient: string | null;
  /** When this brief was generated */
  generated_at: string;
  /** Executive summary — the most important things to know */
  executive_summary: string;
  /** What is normal for this person (baseline) */
  baseline: CareBriefSection;
  /** Recent changes from baseline */
  recent_changes: CareBriefSection;
  /** Important history (events, decisions, outcomes) */
  important_history: CareBriefSection;
  /** Current concerns and open questions */
  current_concerns: CareBriefSection;
  /** What matters most right now */
  what_matters_now: string[];
  /** What can wait */
  what_can_wait: string[];
  /** Routines and preferences */
  routines_preferences: CareBriefSection;
  /** Medication and medical context */
  medical_context: CareBriefSection;
  /** Safety considerations */
  safety_considerations: CareBriefSection;
  /** Information for other caregivers */
  for_caregivers: string[];
  /** Questions for the next clinician visit */
  questions_for_clinician: string[];
  /** What to watch for */
  what_to_watch: string[];
  /** Confidence in the overall brief */
  confidence: "low" | "medium" | "high";
  /** The source change report (if any) */
  source_report: ChangeReport | null;
};

/**
 * Input for building a care brief.
 */
export type CareBriefInput = {
  /** Care recipient label */
  care_recipient_label: string | null;
  /** Recent changes to describe */
  recent_changes: string[];
  /** Baseline (normal) information */
  baseline_info: string[];
  /** Important history items */
  history_items: string[];
  /** Current open uncertainties */
  open_uncertainties: string[];
  /** What matters now */
  what_matters_now: string[];
  /** What can wait */
  what_can_wait: string[];
  /** Routine and preference information */
  routines_preferences: string[];
  /** Medical context */
  medical_context: string[];
  /** Safety information */
  safety_info: string[];
  /** Questions for clinician */
  questions_for_clinician: string[];
  /** What to watch for */
  what_to_watch: string[];
  /** Information for other caregivers (handoff notes) */
  for_caregivers?: string[];
  /** Optional Change Report to source from */
  source_report?: ChangeReport | null;
};

/**
 * Brief scenarios — different formats for different moments.
 */
export type CareBriefScenario = "new_caregiver" | "doctor_appointment" | "hospital_discharge" | "general_summary";

