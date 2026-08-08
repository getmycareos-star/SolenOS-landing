import type {
  AppointmentInfo,
  CareInstruction,
  CareTimelineEvent,
  MedicalEvent,
  MedicationInfo,
} from "./types";

/**
 * TIMELINE EVENTS — important documents create or update timeline entries so the
 * Living Care Record becomes smarter as more documents are added. Each event is
 * traceable to the document and states what changed and what matters next.
 */

function eventLabel(event: MedicalEvent): string {
  switch (event.kind) {
    case "hospital_visit":
      return "Hospital visit";
    case "discharge":
      return "Hospital discharge";
    case "diagnosis":
      return "Diagnosis mentioned";
    case "procedure":
      return "Procedure";
    case "provider_instruction":
      return "Provider instruction";
  }
}

function eventWhatChanged(event: MedicalEvent): string {
  switch (event.kind) {
    case "hospital_visit":
      return "Added a hospital visit to the care timeline.";
    case "discharge":
      return "Added a hospital discharge event with follow-up context.";
    case "diagnosis":
      return "Recorded a diagnosis as stated in the document (not confirmed).";
    case "procedure":
      return "Added a procedure to the care timeline.";
    case "provider_instruction":
      return "Captured a provider instruction as a care note.";
  }
}

function medEvent(med: MedicationInfo): CareTimelineEvent {
  const date = "Document date";
  let whatChanged = "";
  switch (med.status) {
    case "new":
      whatChanged = `New medication identified: ${med.name}.`;
      break;
    case "discontinued":
      whatChanged = `Medication marked discontinued: ${med.name}.`;
      break;
    case "dosage_changed":
      whatChanged = `Medication dosage change noted: ${med.name}${med.dose ? ` (${med.dose})` : ""}.`;
      break;
    case "continuing":
      whatChanged = `Medication confirmed continuing: ${med.name}.`;
      break;
    default:
      whatChanged = `Medication mentioned: ${med.name}.`;
  }
  const safetyMattersNext: string[] = [];
  if (med.duplicateDose) {
    safetyMattersNext.push(`Confirm the correct dose of ${med.name} before the next dose is given.`);
  }
  if (med.missedDose) {
    safetyMattersNext.push(`Confirm whether a make-up dose of ${med.name} is needed.`);
  }
  if (med.refillProblem) {
    safetyMattersNext.push(`Resolve the ${med.name} refill before it runs out.`);
  }
  if (med.unclearInstructions) {
    safetyMattersNext.push(`Confirm how ${med.name} should be taken.`);
  }
  if (med.uncertainty) {
    safetyMattersNext.push(`Clarify the current status of ${med.name} (name, dose, or purpose).`);
  }
  if (safetyMattersNext.length > 0) {
    return {
      date,
      event: `Medication: ${med.name}`,
      source: "Document",
      whatChanged,
      whatMattersNext: safetyMattersNext.join(" "),
    };
  }

  return {
    date,
    event: `Medication: ${med.name}`,
    source: "Document",
    whatChanged,
    whatMattersNext: med.refill
      ? "Plan a refill."
      : med.concern
        ? "Review the noted concern."
        : "Confirm with the care team if anything is unclear.",
  };
}

function appointmentEvent(appointment: AppointmentInfo): CareTimelineEvent {
  const timeframe = appointment.timeframe ? ` (${appointment.timeframe})` : "";
  const label = appointment.kind.replace(/_/g, " ");
  const who = appointment.who ? ` with ${appointment.who}` : "";
  const mattersNext = appointment.preparation
    ? `Prepare before this: ${appointment.preparation}`
    : "Add to planning and prepare any questions or notes to bring.";
  return {
    date: timeframe || "Upcoming",
    event: `${label.charAt(0).toUpperCase()}${label.slice(1)}: ${appointment.what}${who}${timeframe}`,
    source: "Document",
    whatChanged: `Appointment / follow-up added: ${appointment.what}${who}${timeframe}.`,
    whatMattersNext: mattersNext,
  };
}

function instructionEvent(instruction: CareInstruction): CareTimelineEvent {
  const label = instruction.kind.replace(/_/g, " ");
  const mattersNext = (() => {
    switch (instruction.kind) {
      case "warning_sign":
        return "Know what to watch for and act on it if it appears.";
      case "monitoring_requirement":
        return "Set up a simple way to track this.";
      case "restriction":
        return "Respect this restriction in daily care.";
      default:
        return "Incorporate into daily care.";
    }
  })();
  return {
    date: "Document date",
    event: `Care instruction (${label}): ${instruction.description}`,
    source: "Document",
    whatChanged: `Care instruction captured: ${instruction.description}`,
    whatMattersNext: mattersNext,
  };
}

/**
 * Build timeline events for a document. When `documentsSeenCount` is 0 this is a
 * first document — SolenOS does not claim a full history from one file; events
 * are additive and traceable.
 */
export function buildDocumentTimelineEvents(
  understanding: {
    medicalEvents: MedicalEvent[];
    medications: MedicationInfo[];
    appointments: AppointmentInfo[];
    careInstructions: CareInstruction[];
  },
  sourceName: string,
): CareTimelineEvent[] {
  const events: CareTimelineEvent[] = [];

  for (const event of understanding.medicalEvents) {
    events.push({
      date: event.date ?? "Document date",
      event: `${eventLabel(event)}: ${event.sourceText}`,
      source: sourceName,
      whatChanged: eventWhatChanged(event),
      whatMattersNext: "Add any follow-up requirements to the care plan.",
    });
  }
  for (const med of understanding.medications) {
    events.push(medEvent(med));
  }
  for (const appointment of understanding.appointments) {
    events.push(appointmentEvent(appointment));
  }
  for (const instruction of understanding.careInstructions) {
    events.push(instructionEvent(instruction));
  }

  return events;
}
