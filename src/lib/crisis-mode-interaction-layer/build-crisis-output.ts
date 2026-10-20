import { MAX_IMMEDIATE_CONCERNS, MAX_LINES_PER_SECTION } from "./contract-constants";
import type { BehaviorInterpretationResult } from "../behavior-interpretation-engine/types";
import type { CanonicalCareEvent } from "../situation-entry/types";
import type { CrisisModeOutput, CrisisUrgencyLevel } from "./types";

function line(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 120);
}

function cap(items: string[], max: number): string[] {
  return items.filter(Boolean).slice(0, max);
}

export function buildCrisisOutput(input: {
  events_created: CanonicalCareEvent[];
  behavior: BehaviorInterpretationResult;
  trigger_reasons: string[];
  urgency_level: CrisisUrgencyLevel;
  attention_event_ids: string[];
}): CrisisModeOutput {
  const immediate_concerns: string[] = [];

  for (const event of input.events_created) {
    immediate_concerns.push(line(`Observed: ${event.raw_input}`));
  }
  for (const reason of input.trigger_reasons.slice(0, 2)) {
    immediate_concerns.push(line(reason));
  }
  if (immediate_concerns.length === 0 && input.behavior.observed_behaviors.length > 0) {
    immediate_concerns.push(
      line(`Observed: ${input.behavior.observed_behaviors[0]!.raw_observation}`),
    );
  }
  if (immediate_concerns.length === 0) {
    immediate_concerns.push("Urgent situation reported — verify safety now");
  }

  const immediate_actions: string[] = [];
  for (const action of input.behavior.escalation.suggested_actions.slice(0, 3)) {
    immediate_actions.push(line(action));
  }
  if (immediate_actions.length === 0) {
    immediate_actions.push("Ensure immediate physical safety");
    immediate_actions.push("Stay calm and present with care recipient");
    immediate_actions.push("Document what you observe right now");
  }

  const do_not_do: string[] = [
    "Do not force food, fluids, or medication during agitation",
    "Do not leave alone if fall or confusion risk is present",
  ];
  if (input.urgency_level !== "critical") {
    do_not_do.push("Do not assume medical cause — observe and report facts");
  }

  const monitor: string[] = [
    "Breathing and responsiveness",
    "Level of confusion or agitation",
    "Ability to stand or walk safely",
    "Food, fluid, and medication intake",
  ];

  const escalation = {
    clinician:
      input.urgency_level === "critical" || input.attention_event_ids.length >= 2
        ? "Contact primary clinician or on-call nurse if symptoms persist or worsen"
        : "Contact care team if situation does not stabilize within 2 hours",
    emergency_services:
      input.urgency_level === "critical"
        ? "Call emergency services if breathing difficulty, loss of consciousness, or uncontrolled bleeding"
        : "Call emergency services if sudden severe change or immediate danger",
    caregiver_network:
      "Notify backup caregiver or family contact to share load and observation",
  };

  return {
    immediate_concerns: cap(immediate_concerns, MAX_IMMEDIATE_CONCERNS),
    immediate_actions: cap(immediate_actions, MAX_LINES_PER_SECTION),
    do_not_do: cap(do_not_do, MAX_LINES_PER_SECTION),
    monitor: cap(monitor, MAX_LINES_PER_SECTION),
    escalation,
  };
}
