import type {
  AppointmentInfo,
  CareInstruction,
  CareJourneyUnderstanding,
  MedicalEvent,
  MedicationInfo,
} from "./types";

/**
 * CAREGIVER TRANSLATION — turn medical language into caregiver understanding.
 * Never repeats medical language alone; it answers "what does this mean for
 * managing care?". Translation is illustrative of meaning, never a diagnosis,
 * treatment validation, or care decision.
 */

function medicationTranslation(med: MedicationInfo): string {
  const parts: string[] = [];
  parts.push(`${med.name} is mentioned in this document.`);
  switch (med.status) {
    case "new":
      parts.push("It is marked as new — check whether to add it to the care routine.");
      break;
    case "discontinued":
      parts.push("The document indicates it is discontinued — confirm before removing it from the routine.");
      break;
    case "dosage_changed":
      parts.push("The dosage appears to have changed — confirm the new amount before updating the routine.");
      break;
    case "continuing":
      parts.push("It appears to be a continuing medication.");
      break;
    default:
      parts.push("Its current status is not stated clearly in this document.");
  }
  if (med.dose) parts.push(`Dose mentioned: ${med.dose}.`);
  if (med.frequency) parts.push(`Frequency mentioned: ${med.frequency}.`);
  if (med.duplicateDose) {
    parts.push("A possible duplicate dose is mentioned — confirm the correct amount before the next dose.");
  }
  if (med.missedDose) {
    parts.push("A missed dose is mentioned — check whether a make-up dose is needed.");
  }
  if (med.refillProblem) {
    parts.push("A refill problem is mentioned — resolve it before the medication runs out.");
  }
  if (med.unclearInstructions) {
    parts.push("The instructions are unclear — confirm how it should be taken.");
  }
  if (med.uncertainty) {
    parts.push("The current medication situation needs clarification — the name, dose, or purpose is not clear.");
  }
  if (med.refill) parts.push("A refill is mentioned — plan to handle it before it runs out.");
  if (med.concern) parts.push("A concern (such as a side effect or interaction) is mentioned — worth noting.");
  return parts.join(" ");
}

function eventTranslation(event: MedicalEvent): string {
  switch (event.kind) {
    case "hospital_visit":
      return `A hospital visit is mentioned${event.date ? ` on ${event.date}` : ""}. Add it to the care timeline so the care record stays complete.`;
    case "discharge":
      return `A hospital discharge is mentioned${event.date ? ` on ${event.date}` : ""}. Note any follow-up listed after discharge.`;
    case "diagnosis":
      return `A diagnosis is mentioned${event.date ? ` on ${event.date}` : ""}. Record it as stated — SolenOS does not confirm diagnoses.`;
    case "procedure":
      return `A procedure is mentioned${event.date ? ` on ${event.date}` : ""}. Add it to the care timeline.`;
case "provider_instruction":
      return `A provider instruction is mentioned. Capture it as a care instruction.`;
    default:
      return `A medical event is mentioned${event.date ? ` on ${event.date}` : ""} — add it to the care record.`;
  }
}

function appointmentTranslation(appointment: AppointmentInfo): string {
  const when = appointment.timeframe ? ` (${appointment.timeframe})` : "";
  const who = appointment.who ? ` with ${appointment.who}` : "";
  const prep = appointment.preparation ? ` ${appointment.preparation}` : "";
  switch (appointment.kind) {
    case "recommended_follow_up":
      return `A follow-up is recommended${when}${who}. Add it to planning and prepare for it.${prep}`;
    case "specialist_referral":
      return `A specialist referral is mentioned${when}${who}. Consider scheduling and gathering relevant notes/symptoms to share.${prep}`;
    case "upcoming_visit":
      return `An upcoming visit is mentioned${when}${who}. Add it to planning.${prep}`;
    case "deadline":
      return `A deadline is stated${when}. Track it so nothing is missed.${prep}`;
    case "family_discussion":
      return `A family discussion is mentioned${when}${who}: ${appointment.description}.${prep}`;
case "planned_care_decision":
      return `A planned care decision is mentioned${when}${who}: ${appointment.description}.${prep}`;
    default:
      return `An upcoming appointment is mentioned${when}${who}. Add it to planning.${prep}`;
  }
}

function instructionTranslation(instruction: CareInstruction): string {
  switch (instruction.kind) {
    case "restriction":
      return `A restriction is stated: ${instruction.description}`;
    case "monitoring_requirement":
      return `Something should be monitored: ${instruction.description} — set up a simple way to track it.`;
    case "warning_sign":
      return `A warning sign is listed: ${instruction.description} — know what to watch for.`;
    case "recommended_action":
      return `A recommended action is stated: ${instruction.description}`;
case "provider_instruction":
      return `A provider instruction is stated: ${instruction.description}`;
    default:
      return `A care instruction is stated: ${instruction.description}`;
  }
}

/**
 * Build caregiver-facing plain-language understanding for a document.
 * Returns up to `max` lines; keeps the most decision-relevant items first.
 */
export function buildCaregiverTranslation(
  understanding: CareJourneyUnderstanding,
  max = 8,
): string[] {
  const lines: string[] = [];

  for (const med of understanding.medications) {
    lines.push(medicationTranslation(med));
  }
  for (const event of understanding.medicalEvents) {
    lines.push(eventTranslation(event));
  }
  for (const appointment of understanding.appointments) {
    lines.push(appointmentTranslation(appointment));
  }
  for (const instruction of understanding.careInstructions) {
    lines.push(instructionTranslation(instruction));
  }
  for (const person of understanding.people) {
    lines.push(`${person.name} (${person.role}) is involved in this document.`);
  }

  return lines.slice(0, max);
}

/** Build "what should I know / do next / questions remain" caregiver summary. */
export function buildCaregiverSummary(
  understanding: CareJourneyUnderstanding,
): {
  whatHappened: string[];
  whatChanged: string[];
  whatToKnow: string[];
  whatToDoNext: string[];
  questionsRemain: string[];
} {
  const whatHappened: string[] = [];
  for (const event of understanding.medicalEvents) {
    whatHappened.push(event.sourceText);
  }
  for (const med of understanding.medications) {
    whatHappened.push(med.sourceText[0] ?? `${med.name} mentioned.`);
  }

  const whatToKnow: string[] = [];
  for (const instruction of understanding.careInstructions) {
    whatToKnow.push(instructionTranslation(instruction));
  }
  for (const person of understanding.people) {
    whatToKnow.push(`${person.name} (${person.role}).`);
  }

  const whatToDoNext: string[] = [];
  for (const appointment of understanding.appointments) {
    whatToDoNext.push(appointmentTranslation(appointment));
  }
  for (const med of understanding.medications) {
    if (med.refill) {
      whatToDoNext.push(`Plan a refill for ${med.name}.`);
    }
  }

  return {
    whatHappened,
    whatChanged: [...understanding.whatChanged],
    whatToKnow,
    whatToDoNext,
    questionsRemain: [...understanding.uncertainties],
  };
}
