import type { CanonicalCareEvent } from "../situation-entry/types";
import type { CareStateSnapshot } from "../care-state-engine/types";
import type {
  CareRecordModel,
  ConfidenceScoreEntry,
  DailyCareConfidenceModel,
  UnderstandingLevel,
} from "./types";

function isMed(text: string): boolean {
  return /\b(med(?:ication|s)?|dose|pharmacy|prescription|pill)\b/i.test(text);
}

function isDecision(text: string): boolean {
  return /\b(decid(?:ed|e|ing)|chose|agreed|will (?:start|stop|change)|family (?:decided|agreed))\b/i.test(
    text,
  );
}

function isTaskLike(text: string): boolean {
  return /\b(call|schedule|follow[- ]?up|appoint|refill|bring|ask (?:the )?doctor)\b/i.test(
    text,
  );
}

function isRiskLike(text: string): boolean {
  return /\b(fell|fall|wander|urgent|crisis|unsafe|chok|dehydrat|infection|missed dose)\b/i.test(
    text,
  );
}

function isObservation(text: string): boolean {
  return /\b(seem|noticed|confused|appetite|sleep|agitated|refused|eating|walking)\b/i.test(
    text,
  );
}

function deriveOutcomeSummaries(events: CanonicalCareEvent[]): string[] {
  const outcomes: string[] = [];
  for (const e of events) {
    if (/\b(helped|improved|better|worked|calmed|resolved)\b/i.test(e.raw_input)) {
      outcomes.push(`Helped: ${e.raw_input.slice(0, 100)}`);
    } else if (/\b(did not help|worse|no change|failed|didn't work)\b/i.test(e.raw_input)) {
      outcomes.push(`Did not help: ${e.raw_input.slice(0, 100)}`);
    }
  }
  return outcomes.slice(-6);
}

function preferLines(primary: string[], fallback: string[], limit: number): string[] {
  const merged = [...primary, ...fallback]
    .map((l) => l.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const line of merged) {
    if (out.some((x) => x.toLowerCase() === line.toLowerCase())) continue;
    out.push(line);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Project the CareRecord spine from CareEvents (+ Care State when present).
 * Documents / chat / voice are inputs into this model — never the product.
 */
export function projectCareRecordModel(input: {
  care_recipient_id: string;
  events: CanonicalCareEvent[];
  unknowns: string[];
  as_of: string;
  /** Prefer Care State spine fields when the engine has already projected them. */
  care_state?: CareStateSnapshot | null;
  /** Caregiver-facing display name — never invent Mom/patient from notes. */
  subject_label?: string | null;
}): CareRecordModel {
  const active = input.events.filter(
    (e) => e.status !== "invalidated" && e.status !== "superseded",
  );
  const careState = input.care_state ?? null;

  const medsFromEvents = active.filter(
    (e) => isMed(e.raw_input) || e.extracted_type.includes("medication"),
  );
  const decisionsFromEvents = active.filter(
    (e) => isDecision(e.raw_input) || e.extracted_type.includes("decision"),
  );
  const tasksFromEvents = active.filter((e) => isTaskLike(e.raw_input));
  const risksFromEvents = active.filter((e) => isRiskLike(e.raw_input));
  const observationsFromEvents = active.filter((e) => isObservation(e.raw_input));

  const medications = preferLines(
    careState?.medications ?? [],
    medsFromEvents.map((e) => e.raw_input.slice(0, 120)),
    6,
  );
  const decisions = preferLines(
    careState?.decisions ?? [],
    decisionsFromEvents.map((e) => e.raw_input.slice(0, 120)),
    6,
  );
  const tasks = preferLines(
    careState?.tasks ?? [],
    tasksFromEvents.map((e) => e.raw_input.slice(0, 120)),
    6,
  );
  const risks = preferLines(
    careState?.risks ?? [],
    risksFromEvents.map((e) => e.raw_input.slice(0, 120)),
    6,
  );
  const observations = preferLines(
    careState?.observations ?? [],
    observationsFromEvents.map((e) => e.raw_input.slice(0, 120)),
    8,
  );
  const unknowns = preferLines(
    careState?.unknowns ?? [],
    input.unknowns,
    8,
  );
  const events = preferLines(
    careState?.events ?? [],
    active.slice(-12).map((e) => `${e.extracted_type}: ${e.raw_input.slice(0, 100)}`),
    12,
  );

  const who =
    input.subject_label?.trim() &&
    input.subject_label.trim() !== "Your loved one" &&
    input.subject_label.trim() !== "they"
      ? input.subject_label.trim()
      : null;

  const person_profile = preferLines(
    [
      who ? `Care recipient: ${who}` : "Care recipient recorded in the Living Care Record",
      "Living Care Record — evolving understanding of one person's care journey",
      ...(careState?.current_understanding
        ? [careState.current_understanding.slice(0, 160)]
        : []),
      ...(careState?.person_context ?? []).filter(
        (line) => !/care recipient scope:/i.test(line),
      ),
    ],
    [],
    4,
  );

  const confidence_scores: ConfidenceScoreEntry[] =
    careState?.confidence_scores?.length
      ? careState.confidence_scores.map((c) => ({
          area: c.area,
          level: c.level,
          note: c.note,
        }))
      : [
          {
            area: "events",
            level: active.length >= 3 ? "high" : active.length >= 1 ? "medium" : "low",
            note:
              active.length === 0
                ? "No CareEvents yet — CareRecord forming."
                : `${active.length} CareEvent(s) ground this record.`,
          },
          {
            area: "medications",
            level: medications.length > 0 ? "medium" : "low",
            note:
              medications.length > 0
                ? "Medication-related events present; adherence may still be unknown."
                : "Little medication confirmation in the record.",
          },
          {
            area: "unknowns",
            level:
              unknowns.length === 0 ? "high" : unknowns.length <= 2 ? "medium" : "low",
            note:
              unknowns.length === 0
                ? "No explicit information gaps surfaced."
                : `${unknowns.length} blind spot(s) tracked.`,
          },
        ];

  return {
    care_recipient_id: input.care_recipient_id,
    computed_at: input.as_of,
    person_profile,
    events,
    observations,
    medications,
    decisions,
    outcomes: deriveOutcomeSummaries(active),
    tasks,
    risks,
    unknowns,
    confidence_scores,
  };
}

export function projectDailyCareConfidence(input: {
  care_record: CareRecordModel;
  recent_changes: string[];
  needs_attention: string[];
  what_is_stable: string[];
  what_matters_now?: string;
  what_can_wait?: string;
  event_count: number;
}): DailyCareConfidenceModel {
  const gaps = input.care_record.unknowns;
  const concerns = [
    ...input.needs_attention,
    ...input.care_record.risks.slice(0, 3),
  ].slice(0, 5);

  let understanding_level: UnderstandingLevel = "limited_information";
  if (input.event_count === 0) understanding_level = "limited_information";
  else if (concerns.length > 0 || gaps.length > 2) understanding_level = "needs_attention";
  else understanding_level = "good";

  const things_to_know = [
    ...input.recent_changes.slice(0, 3),
    ...(input.what_matters_now ? [input.what_matters_now] : []),
  ].slice(0, 5);

  // Never claim "nothing requires action" from incomplete keyword-derived state.
  const nothing_urgent =
    concerns.length === 0
      ? [
          gaps.length > 0
            ? "No urgent concern is clear from current evidence — some context is still missing."
            : "No urgent concern is clear from what is in the Living Care Record so far.",
          ...(input.what_can_wait ? [input.what_can_wait] : []),
        ]
      : input.what_is_stable.slice(0, 2);

  const ten_minute_priorities =
    concerns.length > 0
      ? concerns.slice(0, 3)
      : things_to_know.length > 0
        ? things_to_know.slice(0, 3)
        : ["Continue observing; the Living Care Record will update as new events arrive."];

  return {
    understanding_level,
    recent_changes: input.recent_changes.slice(0, 5),
    things_to_know,
    potential_concerns: concerns,
    nothing_urgent: nothing_urgent.slice(0, 3),
    information_gaps: gaps.slice(0, 5),
    ten_minute_priorities,
  };
}
