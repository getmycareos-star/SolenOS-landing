/**
 * Care Brief Builder — composes existing care state into a living care context
 * summary designed for knowledge transfer and decision readiness.
 *
 * Dementia Wedge use cases:
 * - New Caregiver Starts: Knowledge transfer without relying on memory
 * - Doctor Appointment: Decision-ready care brief
 * - Hospital Discharge: Transition context + next steps
 *
 * Core principle:
 * "Caregivers do not need another place to store notes.
 *  They need help understanding what changed, why it matters,
 *  what information is important, and what decision needs to happen next."
 */

import type { CareBrief, CareBriefInput, CareBriefSection, CareBriefScenario } from "./types";
import type { ChangeReport } from "../change-report/types";

// ─── Builder ─────────────────────────────────────────────────────────────

/**
 * Build a comprehensive Care Brief from care state input.
 */
export function buildCareBrief(input: CareBriefInput): CareBrief {
  const now = new Date().toISOString();
  const report = input.source_report ?? null;

  // Build sections
  const baseline: CareBriefSection = {
    title: "What is normal",
    items: input.baseline_info.length > 0
      ? input.baseline_info.slice(0, 5)
      : ["Baseline information is still being gathered — add what you know about their usual patterns."],
  };

  const recentChanges: CareBriefSection = {
    title: "Recent changes",
    items: input.recent_changes.length > 0
      ? input.recent_changes.slice(0, 5)
      : ["No recent changes recorded yet."],
  };

  const importantHistory: CareBriefSection = {
    title: "Important history",
    items: input.history_items.length > 0
      ? input.history_items.slice(0, 5)
      : ["Care history is being built over time."],
  };

  const currentConcerns: CareBriefSection = {
    title: "Current concerns and open questions",
    items: input.open_uncertainties.length > 0
      ? input.open_uncertainties.slice(0, 5)
      : ["No open concerns recorded."],
  };

  const routinesPreferences: CareBriefSection = {
    title: "Routines and preferences",
    items: input.routines_preferences.length > 0
      ? input.routines_preferences.slice(0, 5)
      : ["Routines and preferences are not yet documented."],
  };

  const medicalContext: CareBriefSection = {
    title: "Medical context",
    items: input.medical_context.length > 0
      ? input.medical_context.slice(0, 5)
      : ["Medical context is not yet documented."],
  };

  const safetyConsiderations: CareBriefSection = {
    title: "Safety considerations",
    items: input.safety_info.length > 0
      ? input.safety_info.slice(0, 5)
      : ["No specific safety concerns documented."],
  };

  // Build executive summary
  const executiveParts: string[] = [];
  if (input.care_recipient_label) {
    executiveParts.push(`Care context for ${input.care_recipient_label}`);
  }
  if (input.recent_changes.length > 0) {
    executiveParts.push(`Recent changes: ${input.recent_changes.slice(0, 2).join("; ")}`);
  }
  if (input.open_uncertainties.length > 0) {
    executiveParts.push(`Open questions: ${input.open_uncertainties.length} areas need clarification`);
  }
  const executiveSummary = executiveParts.length > 0
    ? executiveParts.join(". ") + "."
    : "Care context is being built as observations are added.";

  // Determine confidence
  let confidence: "low" | "medium" | "high" = "low";
  const infoScore = [
    input.baseline_info.length,
    input.recent_changes.length,
    input.history_items.length,
    input.routines_preferences.length,
    input.medical_context.length,
    input.safety_info.length,
  ].filter((n) => n > 0).length;
  if (infoScore >= 4 && input.recent_changes.length >= 2) {
    confidence = "high";
  } else if (infoScore >= 2) {
    confidence = "medium";
  }

  return {
    care_recipient: input.care_recipient_label,
    generated_at: now,
    executive_summary: executiveSummary,
    baseline,
    recent_changes: recentChanges,
    important_history: importantHistory,
    current_concerns: currentConcerns,
    what_matters_now: input.what_matters_now.slice(0, 4),
    what_can_wait: input.what_can_wait.slice(0, 3),
    routines_preferences: routinesPreferences,
    medical_context: medicalContext,
    safety_considerations: safetyConsiderations,
    for_caregivers: buildCaregiverHandoff(input, report),
    questions_for_clinician: input.questions_for_clinician.slice(0, 5),
    what_to_watch: input.what_to_watch.slice(0, 5),
    confidence,
    source_report: report,
  };
}

// ─── Scenario-specific builders ──────────────────────────────────────────

/**
 * Build a Care Brief tailored for a specific scenario.
 */
export function buildCareBriefForScenario(
  input: CareBriefInput,
  scenario: CareBriefScenario,
): CareBrief {
  const base = buildCareBrief(input);

  switch (scenario) {
    case "new_caregiver":
      return buildNewCaregiverBrief(base, input);
    case "doctor_appointment":
      return buildDoctorAppointmentBrief(base, input);
    case "hospital_discharge":
      return buildHospitalDischargeBrief(base, input);
    default:
      return base;
  }
}

/**
 * New Caregiver Brief — emphasizes routines, preferences, and essential knowledge.
 */
function buildNewCaregiverBrief(
  base: CareBrief,
  input: CareBriefInput,
): CareBrief {
  return {
    ...base,
    executive_summary: `Care context for ${input.care_recipient_label || "the person you care for"} — what to know, what to watch, and what matters most.`,
    for_caregivers: [
      "The person's routines and preferences are documented in this brief — refer to them for consistent care.",
      "Recent changes are noted — watch whether they continue or new patterns emerge.",
      "Open questions are listed — share what you learn with the family and care team.",
      "Add observations as you notice changes — every detail helps build a clearer picture.",
      ...(input.for_caregivers ?? []),
    ].slice(0, 6),
  };
}

/**
 * Doctor Appointment Brief — emphasizes changes, questions, and timeline.
 */
function buildDoctorAppointmentBrief(
  base: CareBrief,
  input: CareBriefInput,
): CareBrief {
  return {
    ...base,
    executive_summary: `Preparation for ${input.care_recipient_label || "your loved one"}'s appointment — key changes, open questions, and what matters to discuss.`,
    for_caregivers: [
      "Share the recent changes with the clinician — focus on what is different from usual.",
      "Bring the open questions — they help structure the conversation.",
      "Note what the clinician recommends so it can be added to the care record.",
    ].slice(0, 4),
  };
}

/**
 * Hospital Discharge Brief — emphasizes transition context and next steps.
 */
function buildHospitalDischargeBrief(
  base: CareBrief,
  input: CareBriefInput,
): CareBrief {
  return {
    ...base,
    executive_summary: `Transition from hospital for ${input.care_recipient_label || "your loved one"} — what changed, what to watch, and next steps.`,
    for_caregivers: [
      "Monitor for changes since discharge — note anything that seems different from before the hospital stay.",
      "Keep tracking follow-up appointments and medication changes.",
      "Share observations with the care team — they need to know what is happening at home.",
    ].slice(0, 4),
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────

/**
 * Build caregiver handoff information from input + report.
 */
function buildCaregiverHandoff(
  input: CareBriefInput,
  report: ChangeReport | null,
): string[] {
  const items: string[] = [];

  if (report?.information_for_caregivers) {
    items.push(...report.information_for_caregivers);
  }

  if (input.recent_changes.length > 0) {
    items.push(`Recent changes to be aware of: ${input.recent_changes.slice(0, 2).join("; ")}`);
  }

  if (input.what_to_watch.length > 0) {
    items.push(`Watch for: ${input.what_to_watch.slice(0, 2).join("; ")}`);
  }

  if (items.length === 0) {
    items.push("Share observations as they happen — the care record builds understanding over time.");
  }

  return items.slice(0, 6);
}

