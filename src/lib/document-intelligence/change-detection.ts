import type {
  CareChange,
  CareJourneyUnderstanding,
  CarePerson,
  MedicationInfo,
} from "./types";

/**
 * CHANGE DETECTION — compare a new document's care understanding against what
 * SolenOS already holds, and classify what changed: New / Changed / Missing /
 * Unclear. SolenOS never resolves a conflict automatically — it surfaces it for
 * confirmation.
 */

function normalize(str: string): string {
  return str.trim().toLowerCase().replace(/\s+/g, " ");
}

function medicationKey(med: MedicationInfo): string {
  return normalize(med.name);
}

function personKey(person: CarePerson): string {
  return normalize(person.name);
}

/**
 * Detect changes between a new document's understanding and prior understanding.
 * `prior` may be empty for a first document — every substantive finding is then "new".
 */
export function detectCareChanges(
  fresh: CareJourneyUnderstanding,
  prior: CareJourneyUnderstanding | null,
): CareChange[] {
  const changes: CareChange[] = [];
  const priorMeds = prior?.medications ?? [];
  const priorPeople = prior?.people ?? [];
  const priorEvents = prior?.medicalEvents ?? [];
  const priorApps = prior?.appointments ?? [];
  const priorInstructions = prior?.careInstructions ?? [];

  // ── Medications ──
  const freshMeds = fresh.medications;
  if (freshMeds.length === 0 && priorMeds.length > 0) {
    changes.push({
      kind: "missing",
      category: "medication",
      label: "No medication information in this document",
      detail: "The prior record mentions medications, but this document does not. This may be expected.",
    });
  }
  for (const med of freshMeds) {
    const key = medicationKey(med);
    const priorMed = priorMeds.find((p) => normalize(p.name) === key);
    if (!priorMed) {
      changes.push({
        kind: med.status === "discontinued" ? "changed" : "new",
        category: "medication",
        label: `Medication: ${med.name}`,
        detail: med.status === "discontinued"
          ? `The document indicates ${med.name} is discontinued.`
          : `This document mentions ${med.name}${med.dose ? ` (${med.dose})` : ""}.`,
        field: "medication",
      });
      continue;
    }
    if (med.dose && priorMed.dose && normalize(med.dose) !== normalize(priorMed.dose)) {
      changes.push({
        kind: "changed",
        category: "medication",
        label: `Medication dose changed: ${med.name}`,
        detail: `Document shows ${med.dose} vs previously ${priorMed.dose}.`,
        field: "dose",
      });
    }
    if (med.status === "discontinued" && priorMed.status !== "discontinued") {
      changes.push({
        kind: "changed",
        category: "medication",
        label: `Medication discontinued: ${med.name}`,
        detail: `The document indicates ${med.name} is no longer being taken.`,
        field: "status",
      });
    }
    // High-priority medication safety signals — surfaced for care coordination.
    if (med.duplicateDose) {
      changes.push({
        kind: "unclear",
        category: "medication",
        label: `Possible duplicate dose: ${med.name}`,
        detail: `The document lists ${med.name} more than once — confirm the correct dose before the next dose is given.`,
        field: "duplicateDose",
      });
    }
    if (med.missedDose) {
      changes.push({
        kind: "changed",
        category: "medication",
        label: `Missed dose for ${med.name}`,
        detail: `The document mentions a missed dose of ${med.name} — confirm whether a make-up dose is needed.`,
        field: "missedDose",
      });
    }
    if (med.refillProblem) {
      changes.push({
        kind: "changed",
        category: "medication",
        label: `Refill problem: ${med.name}`,
        detail: `The document notes a refill problem for ${med.name} — resolve supply before it runs out.`,
        field: "refillProblem",
      });
    }
    if (med.unclearInstructions) {
      changes.push({
        kind: "unclear",
        category: "medication",
        label: `Unclear instructions: ${med.name}`,
        detail: `The instructions for ${med.name} are not clear in this document — confirm how it should be taken.`,
        field: "unclearInstructions",
      });
    }
    if (med.uncertainty) {
      changes.push({
        kind: "unclear",
        category: "medication",
        label: `Medication uncertainty: ${med.name}`,
        detail: `The current medication situation for ${med.name} is not clearly stated — confirm the name, dose, or purpose.`,
        field: "uncertainty",
      });
    }
  }

  // ── Providers / people ──
  for (const person of fresh.people) {
    const exists = priorPeople.some((p) => personKey(p) === personKey(person));
    if (!exists) {
      changes.push({
        kind: "new",
        category: "provider",
        label: `Provider: ${person.name}`,
        detail: `This document introduces ${person.name} (${person.role}).`,
        field: "provider",
      });
    }
  }

  // ── Medical events ──
  for (const event of fresh.medicalEvents) {
    const exists = priorEvents.some(
      (p) => normalize(p.sourceText) === normalize(event.sourceText),
    );
    if (!exists) {
      changes.push({
        kind: "new",
        category: "medical_event",
        label: `Medical event: ${event.kind.replace(/_/g, " ")}`,
        detail: event.date
          ? `${event.sourceText} (${event.date})`
          : event.sourceText,
        field: "medical_event",
      });
    }
  }

  // ── Appointments / follow-ups ──
  for (const app of fresh.appointments) {
    const exists = priorApps.some(
      (p) => normalize(p.sourceText) === normalize(app.sourceText),
    );
    if (!exists) {
      changes.push({
        kind: "new",
        category: "appointment",
        label: `Appointment / follow-up: ${app.kind.replace(/_/g, " ")}`,
        detail: app.timeframe
          ? `${app.description} (${app.timeframe})`
          : app.description,
        field: "appointment",
      });
    }
  }

  // ── Care instructions ──
  for (const instruction of fresh.careInstructions) {
    const exists = priorInstructions.some(
      (p) => normalize(p.sourceText) === normalize(instruction.sourceText),
    );
    if (!exists) {
      changes.push({
        kind: "new",
        category: "care_instruction",
        label: `Care instruction: ${instruction.kind.replace(/_/g, " ")}`,
        detail: instruction.description,
        field: "care_instruction",
      });
    }
  }

  // ── Unclear / conflicting signals ──
  if (fresh.uncertainties.length > 0) {
    for (const uncertainty of fresh.uncertainties) {
      changes.push({
        kind: "unclear",
        category: "other",
        label: "Unclear information",
        detail: uncertainty,
      });
    }
  }

  return changes;
}

/** Build a human-facing "what changed" list from detected changes. */
export function changesToWhatChanged(changes: CareChange[]): string[] {
  return changes.map((change) => {
    switch (change.kind) {
      case "new":
        return `New — ${change.label}. ${change.detail}`;
      case "changed":
        return `Changed — ${change.label}. ${change.detail}`;
      case "missing":
        return `Expected but not found — ${change.label}. ${change.detail}`;
      case "unclear":
        return `Unclear — ${change.detail}`;
    }
  });
}
