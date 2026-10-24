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
  if (fromEvents.includes("low")) return "low";
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
  // The current response schema cannot represent unknown risk; use its conservative medium value rather than inventing high risk from a pattern-state label.
  const risk = inferRisk(facts, "medium");
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
      risk_level: risk,
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
    (intervention?.technique ??
      intervention?.label ??
      caseEntity.understanding.successfulInterventions[0])?.trim() || null;

  return {
    what_is_happening:
      primaryType === "wandering"
        ? `${name} is experiencing another nighttime wandering episode`
        : `${name} is experiencing another ${primaryType} episode`,
    what_matters_now: technique
      ? `A previously recorded approach (${technique}) is linked to this pattern. Confirm it still fits; past use does not establish that it will work now.`
      : "A strong similarity to prior events was detected, but no previously successful intervention is recorded. Confirm immediate safety and ask what has helped before.",
    what_to_ask_next:
      "Has anything changed in the current environment or routine, and what has helped in similar situations before?",
    risk_level: risk,
    what_can_wait: "Administrative tasks and non-urgent updates",
    follow_up_items: [
      technique
        ? `Consider whether the previously recorded approach (${technique}) still fits; confirm current safety first.`
        : "Ask what, if anything, has helped in similar situations; do not assume an intervention is effective.",
      "Check whether the current environment or routine differs from prior observations.",
      "Monitor and record the observed response; effectiveness is not assumed.",
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
