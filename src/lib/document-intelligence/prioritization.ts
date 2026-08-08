import type {
  AppointmentInfo,
  CareInstruction,
  CareJourneyUnderstanding,
  MedicalEvent,
  MedicationInfo,
} from "./types";

/**
 * CAREGIVER-IMPACT PRIORITIZATION — classify what a document surfaces by how much
 * it demands from a stressed family caregiver right now.
 *
 * Mirrors the Living Care Record pillars:
 *   immediateAttention  → "What needs my attention?" (may require action soon)
 *   importantToTrack    → "What should I keep in mind?" (may become significant)
 *   canWait             → "What is useful but not urgent?"
 *
 * Observational only. Never decides care, never alarms — it organizes.
 */

function affectedByUncertainStatus(med: MedicationInfo): boolean {
  return (
    med.status === "dosage_changed" ||
    med.status === "discontinued" ||
    med.status === "new"
  );
}

function medicationAttention(med: MedicationInfo): string[] {
  const lines: string[] = [];
  const safetyFlags = med.duplicateDose || med.missedDose || med.refillProblem;
  const uncertainty = med.unclearInstructions || med.uncertainty;

  if (med.duplicateDose) {
    lines.push(
      `${med.name} may be listed more than once — confirm the correct dose before the next medication is given.`,
    );
  }
  if (med.missedDose) {
    lines.push(
      `${med.name} has a missed dose mentioned — check whether a make-up dose is needed.`,
    );
  }
  if (med.refillProblem) {
    lines.push(
      `${med.name} has a refill problem mentioned — confirm supply before it runs out.`,
    );
  }
  if (affectedByUncertainStatus(med)) {
    lines.push(
      `${med.name} changed or was discontinued — confirm the current routine before acting.`,
    );
  }
  // Uncertainty without a concrete safety flag still needs attention, not silence.
  if (uncertainty && lines.length === 0) {
    lines.push(
      `${med.name} instructions are unclear — worth clarifying with the care team.`,
    );
  }
  void safetyFlags;
  return lines;
}

function appointmentAttention(appointment: AppointmentInfo): string[] {
  const when = appointment.timeframe ? ` (${appointment.timeframe})` : "";
  const who = appointment.who ? ` with ${appointment.who}` : "";
  const prep = appointment.preparation
    ? ` Prepare: ${appointment.preparation}`
    : "";
  switch (appointment.kind) {
    case "deadline":
      return [
        `Deadline${when}: ${appointment.what}. Complete it so nothing is missed.${prep}`,
      ];
    case "upcoming_visit":
    case "specialist_referral":
    case "recommended_follow_up":
      return [
        `${appointment.what}${when}${who}. Add it to planning.${prep}`,
      ];
    case "family_discussion":
      return [
        `Family discussion${when}${who}: ${appointment.what}.${prep}`,
      ];
    case "planned_care_decision":
      return [
        `Planned care decision${when}${who}: ${appointment.what}.${prep}`,
      ];
  }
}

function instructionAttention(instruction: CareInstruction): string[] {
  switch (instruction.kind) {
    case "warning_sign":
      return [
        `Watch for: ${instruction.description}. Know what to watch for and act on it if it appears.`,
      ];
    case "monitoring_requirement":
      return [
        `Monitor: ${instruction.description}. Set up a simple way to track it.`,
      ];
    case "restriction":
      return [
        `Restriction: ${instruction.description}.`,
      ];
    case "recommended_action":
    case "provider_instruction":
      return [];
  }
}

function eventAttention(event: MedicalEvent): string[] {
  if (event.kind === "discharge") {
    return [
      `Hospital discharge noted${event.date ? ` on ${event.date}` : ""} — review the follow-up plan after discharge.`,
    ];
  }
  return [];
}

function eventTrack(event: MedicalEvent): string[] {
  const date = event.date ? ` on ${event.date}` : "";
  switch (event.kind) {
    case "procedure":
      return [`Procedure noted${date} — add to the care timeline.`];
    case "diagnosis":
      return [`Diagnosis mentioned${date} — record as stated; not confirmed.`];
    case "hospital_visit":
      return [`Hospital visit noted${date} — add to the care timeline.`];
    case "provider_instruction":
      return [`Provider instruction captured — follow as directed.`];
    case "discharge":
      return [];
  }
}

function medicationTrack(med: MedicationInfo): string[] {
  const lines: string[] = [];
  if (med.status === "new") {
    lines.push(`New medication: ${med.name} — watch for how it is tolerated.`);
  }
  if (med.status === "dosage_changed") {
    lines.push(
      `Dosage change for ${med.name} — track the new amount${med.dose ? ` (${med.dose})` : ""}.`,
    );
  }
  if (med.status === "discontinued") {
    lines.push(
      `Discontinued medication: ${med.name} — confirm before removing it from the routine.`,
    );
  }
  if (med.refill) {
    lines.push(
      `Refill for ${med.name} is mentioned — plan to handle it before it runs out.`,
    );
  }
  return lines;
}

function appointmentTrack(app: AppointmentInfo): string[] {
  const when = app.timeframe ? ` (${app.timeframe})` : "";
  const who = app.who ? ` with ${app.who}` : "";
  const line = `${app.what}${who}${when}`;
  if (app.kind === "recommended_follow_up") {
    return [
      `Follow-up recommended: ${line}.${app.preparation ? ` Prepare: ${app.preparation}.` : ""}`,
    ];
  }
  if (app.kind === "family_discussion") {
    return [
      `Family discussion to plan: ${line}.${app.preparation ? ` Prepare: ${app.preparation}.` : ""}`,
    ];
  }
  if (app.kind === "planned_care_decision") {
    return [
      `Planned care decision to prepare: ${line}.${app.preparation ? ` Prepare: ${app.preparation}.` : ""}`,
    ];
  }
  return [];
}

/**
 * Build prioritized caregiver-facing lines from a document's care understanding.
 * High-safety medication signals and hard deadlines go to immediate attention.
 */
export function buildCaregiverPrioritization(
  understanding: CareJourneyUnderstanding,
): {
  immediateAttention: string[];
  importantToTrack: string[];
  canWait: string[];
} {
  const immediateAttention: string[] = [];
  const importantToTrack: string[] = [];
  const canWait: string[] = [];

  for (const med of understanding.medications) {
    immediateAttention.push(...medicationAttention(med));
    importantToTrack.push(...medicationTrack(med));
    if (med.status === "continuing" || med.status === "unknown") {
      canWait.push(
        `${med.name} is noted${med.dose ? ` (${med.dose})` : ""} — no immediate action required.`,
      );
    }
  }

  for (const app of understanding.appointments) {
    immediateAttention.push(...appointmentAttention(app));
    importantToTrack.push(...appointmentTrack(app));
    if (
      app.kind === "upcoming_visit" &&
      !/within|by|tomorrow|this week|next week/i.test(app.timeframe ?? "")
    ) {
      canWait.push(
        `Upcoming visit noted: ${app.what}${app.timeframe ? ` (${app.timeframe})` : ""}.`,
      );
    }
  }

  for (const instruction of understanding.careInstructions) {
    immediateAttention.push(...instructionAttention(instruction));
    if (
      instruction.kind === "recommended_action" ||
      instruction.kind === "provider_instruction"
    ) {
      importantToTrack.push(`${instruction.description}`);
    }
  }

  for (const event of understanding.medicalEvents) {
    immediateAttention.push(...eventAttention(event));
    importantToTrack.push(...eventTrack(event));
  }

  for (const uncertainty of understanding.uncertainties) {
    immediateAttention.push(`To confirm: ${uncertainty}`);
  }

  return {
    immediateAttention: [...new Set(immediateAttention)],
    importantToTrack: [...new Set(importantToTrack)],
    canWait: [...new Set(canWait)],
  };
}
