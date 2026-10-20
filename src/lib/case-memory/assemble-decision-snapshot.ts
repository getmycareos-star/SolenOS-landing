import { CASE_DECISION_SNAPSHOT_KEYS } from "./contract-constants";
import type {
  Case,
  CaseDecisionSnapshot,
  CaseRiskLevel,
  ExtractedCaseFacts,
  PatternResponsePolicyResult,
} from "./types";

function inferRisk(facts: ExtractedCaseFacts, fallback: CaseRiskLevel = "low"): CaseRiskLevel {
  const fromEvents = facts.events.map((e) => e.riskLevel).filter(Boolean) as CaseRiskLevel[];
  if (fromEvents.includes("high")) return "high";
  if (fromEvents.includes("medium")) return "medium";
  return fallback;
}

function recipientLabel(caseEntity: Case): string {
  return caseEntity.profile.preferredName ?? caseEntity.profile.displayName;
}

function formatEmbeddedTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toUTCString().replace(" GMT", " UTC");
}

/**
 * Emit fixed 6-field Decision Snapshot with PRP-aware field weighting.
 * Temporal info embedded IN TEXT only — no separate timestamp fields.
 */
export function assembleDecisionSnapshot(params: {
  caseEntity: Case;
  facts: ExtractedCaseFacts;
  policy: PatternResponsePolicyResult;
  rawInput: string;
}): CaseDecisionSnapshot {
  const { caseEntity, facts, policy, rawInput } = params;
  const name = recipientLabel(caseEntity);
  const risk = inferRisk(facts, policy.state === "C" ? "high" : "medium");
  const primaryType = facts.events[0]?.eventType ?? "general";
  const intervention = policy.preferredIntervention;

  if (policy.state === "A") {
    const happening =
      primaryType === "wandering"
        ? `${name} is experiencing a nighttime wandering episode`
        : primaryType === "condition_noted"
          ? `${name} care profile updated from current input`
          : facts.conditions.length > 0
            ? `${name} has a noted condition update from current input`
            : `Current care input concerning ${name}: ${rawInput.trim().slice(0, 160)}`;

    return {
      what_is_happening: happening,
      what_matters_now:
        primaryType === "condition_noted" || facts.conditions.length > 0
          ? `Record and keep the condition on the case; act only on urgent new symptoms if present`
          : `Respond to the immediate situation described — no prior pattern match`,
      what_to_ask_next: "Is anyone injured, unsafe, or in immediate need of help right now?",
      risk_level: facts.conditions.length > 0 && facts.events.every((e) => e.eventType === "condition_noted") ? "low" : risk,
      what_can_wait: "Administrative tasks and non-urgent updates",
      follow_up_items: [
        "Stabilize the present moment using current observations only",
        "Capture any new concrete facts for the case timeline",
      ],
    };
  }

  if (policy.state === "B") {
    const top = policy.topEvents[0];
    const when = top ? formatEmbeddedTime(top.event.timestamp) : "";
    return {
      what_is_happening: `${name} may be experiencing a recurrence related to ${primaryType}${when ? ` (similar context noted around ${when})` : ""}`,
      what_matters_now: intervention
        ? `A past approach (${intervention.label}) may be relevant — use cautiously while staying present-focused`
        : `There is a weak similarity to prior ${primaryType} events — stay present-focused and confirm safety`,
      what_to_ask_next: "Has anything small changed since the last similar episode (routine, environment, meds)?",
      risk_level: risk,
      what_can_wait: "Deep historical review and non-urgent care planning",
      follow_up_items: [
        "Confirm immediate safety and orientation",
        intervention
          ? `Consider whether ${intervention.label} still fits — do not assume it will work`
          : "Note what helps if the episode settles",
      ],
    };
  }

  // State C — strong pattern → intervention compression (NOT history narration)
  const technique =
    intervention?.technique ??
    intervention?.label ??
    caseEntity.understanding.successfulInterventions[0] ??
    "previously successful intervention";

  return {
    what_is_happening:
      primaryType === "wandering"
        ? `${name} is experiencing another nighttime wandering episode`
        : `${name} is experiencing another ${primaryType} episode`,
    what_matters_now: `This matches a previously stabilized pattern where ${
      /towel|grounding|redirect/i.test(technique)
        ? "redirection using a familiar grounding object reduced agitation quickly"
        : `${technique} reduced escalation quickly`
    }`,
    what_to_ask_next:
      "Check if anything has changed in environment, lighting, or sleep routine since last successful intervention",
    risk_level: risk === "low" ? "high" : risk,
    what_can_wait: "Administrative tasks and non-urgent updates",
    follow_up_items: [
      `Immediately apply previously successful intervention used in similar episodes (${technique})`,
      "Prepare environment to reduce nighttime disorientation (lighting, noise, pathways)",
      "Monitor response time and agitation reduction during this episode",
    ],
  };
}

/** Exact-key guarantee helper for Decision Snapshot. */
export function decisionSnapshotKeys(snapshot: CaseDecisionSnapshot): string[] {
  return Object.keys(snapshot).sort();
}

export function isExactDecisionSnapshotSchema(value: unknown): value is CaseDecisionSnapshot {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const expected = [...CASE_DECISION_SNAPSHOT_KEYS].sort();
  if (keys.length !== expected.length || keys.some((k, i) => k !== expected[i])) return false;
  if (typeof obj.what_is_happening !== "string") return false;
  if (typeof obj.what_matters_now !== "string") return false;
  if (typeof obj.what_to_ask_next !== "string") return false;
  if (obj.risk_level !== "low" && obj.risk_level !== "medium" && obj.risk_level !== "high") return false;
  if (typeof obj.what_can_wait !== "string") return false;
  if (!Array.isArray(obj.follow_up_items) || !obj.follow_up_items.every((x) => typeof x === "string")) {
    return false;
  }
  return true;
}

/** Detect multi-date history dumps (forbidden in State C follow-ups). */
export function listsMultiplePastDates(text: string): boolean {
  const dateHits = text.match(
    /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/gi,
  );
  return (dateHits?.length ?? 0) >= 2;
}
