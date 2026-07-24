import { detectUrgencyLevel } from "../urgency-detection";
import {
  isImmediateDangerLanguage,
  isRetrospectiveCareReport,
} from "../mvp-input-architecture";
import {
  CAREGIVER_DISTRESS_PATTERNS,
  HIGH_SEVERITY_EVENT_PATTERNS,
  SOFT_HELP_PATTERNS,
  SOFT_URGENT_PATTERNS,
  URGENT_INPUT_THRESHOLD,
  URGENT_INPUT_WINDOW_MINUTES,
} from "./contract-constants";
import { isAcuteCrisisFall, mentionsFall } from "./fall-crisis-gate";
import { countRecentUrgentInputs, recordUrgentInput } from "./store";
import type { BehaviorInterpretationResult } from "../behavior-interpretation-engine/types";
import type { CanonicalCareEvent } from "../situation-entry/types";
import type { CrisisUrgencyLevel } from "./types";

function hasSoftHelp(text: string): boolean {
  return SOFT_HELP_PATTERNS.some((p) => p.test(text));
}

function hasSoftUrgent(text: string): boolean {
  return SOFT_URGENT_PATTERNS.some((p) => p.test(text));
}

/**
 * Soft "help me" / "urgent" / "right now" only escalate when acute context exists.
 * Alone they are ordinary overwhelm / scheduling language.
 */
function softDistressCountsAsCrisis(text: string): boolean {
  if (!hasSoftHelp(text) && !hasSoftUrgent(text)) return false;
  if (isRetrospectiveCareReport(text) && !isImmediateDangerLanguage(text)) return false;
  return (
    isImmediateDangerLanguage(text) ||
    isAcuteCrisisFall(text) ||
    CAREGIVER_DISTRESS_PATTERNS.some((p) => p.test(text)) ||
    /\bhelp!\b/i.test(text)
  );
}

function scanText(text: string): string[] {
  const reasons: string[] = [];

  if (isAcuteCrisisFall(text)) {
    reasons.push("High severity: acute fall (immediacy or severity)");
  } else if (mentionsFall(text)) {
    // Bare / retrospective fall — continuity only, not a crisis trigger.
  }

  for (const { pattern, label } of HIGH_SEVERITY_EVENT_PATTERNS) {
    if (pattern.test(text)) reasons.push(`High severity: ${label}`);
  }
  for (const pattern of CAREGIVER_DISTRESS_PATTERNS) {
    if (pattern.test(text)) reasons.push("Caregiver distress signal detected");
  }
  if (softDistressCountsAsCrisis(text)) {
    reasons.push("Caregiver distress signal detected");
  }
  return reasons;
}

function scanEvents(events: CanonicalCareEvent[]): string[] {
  const reasons: string[] = [];
  for (const event of events) {
    reasons.push(...scanText(event.raw_input));
    const snippet = event.attributes.source_situation_text;
    if (typeof snippet === "string") reasons.push(...scanText(snippet));
  }
  return [...new Set(reasons)];
}

export function detectCrisisTriggers(input: {
  caregiver_id: string;
  raw_input: string;
  events_created: CanonicalCareEvent[];
  all_events: CanonicalCareEvent[];
  behavior: BehaviorInterpretationResult;
  as_of: string;
}): { reasons: string[]; urgency_level: CrisisUrgencyLevel } {
  const reasons: string[] = [];
  const continuityOnly =
    isRetrospectiveCareReport(input.raw_input) && !isImmediateDangerLanguage(input.raw_input);

  reasons.push(...scanText(input.raw_input));
  reasons.push(...scanEvents(input.events_created));

  const urgencyDetection = detectUrgencyLevel(input.raw_input);
  if (!continuityOnly) {
    if (urgencyDetection.risk_level === "critical") {
      reasons.push(
        `Critical urgency: ${urgencyDetection.critical_signals.join(", ") || "signal detected"}`,
      );
    } else if (urgencyDetection.risk_level === "high") {
      reasons.push(
        `High urgency: ${urgencyDetection.high_signals.join(", ") || "signal detected"}`,
      );
    }
  }

  if (!continuityOnly) {
    if (input.behavior.behavioral_change_detected) {
      reasons.push("Behavioral change signal — deviation from baseline");
    }
    if (input.behavior.escalation.risk_elevation === "high") {
      reasons.push("Behavior escalation: mild → severe pattern");
    } else if (input.behavior.escalation.risk_elevation === "medium") {
      reasons.push("Behavior escalation detected");
    }

    for (const trigger of input.behavior.escalation.triggers.slice(0, 2)) {
      reasons.push(`Escalation trigger: ${trigger}`);
    }
  }

  const acuteFallEvents = input.all_events.filter(
    (e) => e.status !== "invalidated" && isAcuteCrisisFall(e.raw_input),
  );
  if (acuteFallEvents.length >= 2) {
    reasons.push("Pattern risk: repeated acute falls in CareContext");
  }

  const unique = [...new Set(reasons)];

  // Do not treat continuity capture as "urgent input" for the repeat window.
  const isUrgentInput =
    !continuityOnly && (unique.length > 0 || urgencyDetection.risk_level !== "low");
  if (isUrgentInput && input.raw_input.trim()) {
    recordUrgentInput(input.caregiver_id, input.raw_input.trim(), input.as_of);
  }

  if (!continuityOnly) {
    const recentUrgent = countRecentUrgentInputs(
      input.caregiver_id,
      URGENT_INPUT_WINDOW_MINUTES,
      input.as_of,
    );
    if (recentUrgent >= URGENT_INPUT_THRESHOLD) {
      unique.push(`Repeated urgent inputs (${recentUrgent}) in short window`);
    }
  }

  const finalReasons = [...new Set(unique)];

  // Continuity capture: no crisis urgency from lexical fall/help/urgent alone.
  if (continuityOnly) {
    return { reasons: [], urgency_level: "low" };
  }

  // Behavior / soft signals alone must not open crisis — need severity, acute fall, or strong distress.
  const hardReasons = finalReasons.filter(
    (r) =>
      r.startsWith("High severity:") ||
      r.startsWith("Critical urgency:") ||
      r.startsWith("High urgency:") ||
      r.startsWith("Pattern risk:") ||
      r.includes("Caregiver distress"),
  );
  const crisisReasons = hardReasons.length > 0 ? finalReasons : [];

  let urgency_level: CrisisUrgencyLevel = "low";
  if (
    crisisReasons.some((r) => r.startsWith("Critical")) ||
    (hardReasons.length > 0 && urgencyDetection.risk_level === "critical")
  ) {
    urgency_level = "critical";
  } else if (
    crisisReasons.length >= 2 ||
    (hardReasons.length > 0 && urgencyDetection.risk_level === "high") ||
    (hardReasons.length > 0 && input.behavior.escalation.risk_elevation === "high")
  ) {
    urgency_level = "high";
  } else if (crisisReasons.length >= 1) {
    urgency_level = "medium";
  }

  return { reasons: crisisReasons, urgency_level };
}

export function resolveUiMode(urgency: CrisisUrgencyLevel): import("./types").CrisisUiMode {
  if (urgency === "critical") return "single_action";
  if (urgency === "high") return "checklist";
  if (urgency === "medium") return "condensed";
  return "full";
}

export function crisisModeActive(urgency: CrisisUrgencyLevel, reasonCount: number): boolean {
  return urgency === "high" || urgency === "critical" || (urgency === "medium" && reasonCount >= 2);
}
