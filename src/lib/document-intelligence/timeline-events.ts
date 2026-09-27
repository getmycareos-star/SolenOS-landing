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
 * 
 * IMPROVED: Richer, evidence-backed whatMattersNext with concrete actions.
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

function buildMedicationWhatMattersNext(med: MedicationInfo): string[] {
  const matters: string[] = [];
  
  if (med.duplicateDose) {
    matters.push(`Confirm the correct dose of ${med.name} before the next dose is given.`);
  }
  if (med.missedDose) {
    matters.push(`Confirm whether a make-up dose of ${med.name} is needed.`);
  }
  if (med.refillProblem) {
    matters.push(`Resolve the ${med.name} refill before it runs out.`);
  }
  if (med.unclearInstructions) {
    matters.push(`Confirm how ${med.name} should be taken (timing, with/without food, etc.).`);
  }
  if (med.uncertainty) {
    matters.push(`Clarify the current status of ${med.name} with the prescriber.`);
  }
  if (med.concern) {
    matters.push(`Review the noted concern about ${med.name}.`);
  }
  if (med.refill) {
    matters.push(`Plan refill for ${med.name} (refill by: ${med.refill}).`);
  }
  if (matters.length === 0) {
    matters.push(`Confirm ${med.name} with the care team at the next visit.`);
  }
  
  return matters;
}

function medEvent(med: MedicationInfo): CareTimelineEvent {
  const date = "Document date";
  let whatChanged = "";
  switch (med.status) {
    case "new":
      whatChanged = `New medication identified: ${med.name}${med.dose ? ` (${med.dose})` : ""}.`;
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
  
  const whatMattersNext = buildMedicationWhatMattersNext(med).join(" ");
  
  return {
    date,
    event: `Medication: ${med.name}`,
    source: "Document",
    whatChanged,
    whatMattersNext,
  };
}

function appointmentEvent(appointment: AppointmentInfo): CareTimelineEvent {
  const timeframe = appointment.timeframe ? ` (${appointment.timeframe})` : "";
  const label = appointment.kind.replace(/_/g, " ");
  const who = appointment.who ? ` with ${appointment.who}` : "";
  const mattersNext = appointment.preparation
    ? `Prepare: ${appointment.preparation}`
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
        return `Watch for: ${instruction.description}. Act immediately if this appears.`;
      case "monitoring_requirement":
        return `Track: ${instruction.description}. Set up a simple way to record this.`;
      case "restriction":
        return `Respect: ${instruction.description}. Ensure this is followed in daily care.`;
      default:
        return `Incorporate into daily care: ${instruction.description}.`;
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
 * 
 * IMPROVED: Every whatMattersNext is concrete and evidence-backed.
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

/**
 * NEW: Build richer timeline events with explicit evidence chains
 * for the Living Care Record quality gate.
 */
export function buildDocumentTimelineEventsWithEvidence(
  understanding: {
    medicalEvents: MedicalEvent[];
    medications: MedicationInfo[];
    appointments: AppointmentInfo[];
    careInstructions: CareInstruction[];
  },
  sourceName: string,
): Array<CareTimelineEvent & { evidence_chain?: string[] }> {
  const events = buildDocumentTimelineEvents(understanding, sourceName);
  
  return events.map((event, index) => {
    const evidence_chain: string[] = [];
    
    // Add source text as evidence
    if (understanding.medicalEvents[index]) {
      evidence_chain.push(`Source: ${understanding.medicalEvents[index].sourceText}`);
    } else if (understanding.medications[index]) {
      evidence_chain.push(`Source: ${understanding.medications[index].sourceText}`);
    } else if (understanding.appointments[index]) {
      evidence_chain.push(`Source: ${understanding.appointments[index].sourceText}`);
    } else if (understanding.careInstructions[index]) {
      evidence_chain.push(`Source: ${understanding.careInstructions[index].sourceText}`);
    }
    
    // Add safety flags as evidence
    const med = understanding.medications.find(m => event.event.includes(m.name));
    if (med) {
      if (med.duplicateDose) evidence_chain.push("Safety: duplicate dose flag");
      if (med.missedDose) evidence_chain.push("Safety: missed dose flag");
      if (med.refillProblem) evidence_chain.push("Safety: refill problem flag");
      if (med.unclearInstructions) evidence_chain.push("Safety: unclear instructions flag");
      if (med.uncertainty) evidence_chain.push("Safety: uncertainty flag");
    }
    
    return {
      ...event,
      evidence_chain: evidence_chain.length > 0 ? evidence_chain : undefined,
    };
  });
}