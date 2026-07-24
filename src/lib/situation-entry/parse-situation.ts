import type {
  CanonicalCareEvent,
  CareEventEntity,
  ExtractedType,
  TrackingDimension,
  UnderstoodItem,
} from "./types";
import { withDualTime } from "./dual-time";
import { createIntegrityState } from "../care-event-integrity";
import { createStubPriority } from "../care-event-priority";
import { classifySourceReliability } from "../continuity-properties/source-reliability";
import { sanitizeCaregiverFacingLines } from "./caregiver-facing-uncertainty";
import { toCaregiverFacingLine } from "../mvp-input-architecture";

const FALL = /\b(fell|fall|fallen|tripped|slipped)\b/i;
const INSURANCE = /\b(insurance|claim|rejected|denied|coverage|benefits|billing|payment|debt)\b/i;
const CONFUSION = /\b(confus\w*|disorient\w*|not herself|not himself)\b/i;
const APPETITE =
  /\b(refus\w*\s+to\s+eat|refus\w*\s+(food|eating|meals?)|not eating|won't eat|wont eat|stopped eating|eating less|loss of appetite|appetite|no appetite|food|meal)\b/i;
const DISCHARGE = /\b(discharge|discharged|sent home)\b/i;
const APPOINTMENT = /\b(appointment|follow[- ]?up|visit|clinic|hospital)\b/i;
const COORDINATION = /\b(family|sibling|caregiver|coordinate|schedule|arrange)\b/i;
const DECISION = /\b(decided|decision|signed|agreed|authorized)\b/i;
const OBLIGATION = /\b(must|required|need to|should|deadline|due)\b/i;
const TIME_YESTERDAY = /\byesterday\b/i;
const TIME_TODAY = /\btoday\b/i;
const TIME_LAST_WEEK = /\b(last week|few days ago|recently)\b/i;

const DR = /\bDr\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g;
const INSTITUTION = /\b(hospital|clinic|insurance company|bank|lawyer|attorney|nursing home)\b/gi;
const PERSON = /\b(mom|dad|mother|father|parent|patient|spouse|wife|husband)\b/gi;

export function createCareEventId(): string {
  return `ce_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function classifyExtractedType(text: string): ExtractedType {
  const t = text.trim();
  if (!t) return "unknown";
  if (FALL.test(t)) return "incident";
  if (INSURANCE.test(t)) return "financial_issue";
  if (CONFUSION.test(t)) return "behavioral_change";
  if (DISCHARGE.test(t)) return "observation";
  if (DECISION.test(t)) return "decision";
  if (OBLIGATION.test(t) || APPOINTMENT.test(t)) return "follow_up";
  if (COORDINATION.test(t)) return "coordination_issue";
  if (APPETITE.test(t)) return "observation";
  return "observation";
}

function extractEntities(text: string): CareEventEntity[] {
  const entities: CareEventEntity[] = [];
  const seen = new Set<string>();

  for (const m of text.matchAll(DR)) {
    const label = m[0].trim();
    if (!seen.has(label)) {
      seen.add(label);
      entities.push({ kind: "person", label });
    }
  }
  for (const m of text.matchAll(PERSON)) {
    const label = m[0].trim();
    const key = label.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      entities.push({ kind: "person", label });
    }
  }
  for (const m of text.matchAll(INSTITUTION)) {
    const label = m[0].trim();
    const key = label.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      entities.push({ kind: "institution", label });
    }
  }

  return entities;
}

function extractTimeReference(text: string): string | null {
  if (TIME_YESTERDAY.test(text)) return "yesterday";
  if (TIME_TODAY.test(text)) return "today";
  if (TIME_LAST_WEEK.test(text)) return "recent past (unspecified)";
  const dateMatch = text.match(/\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\w+\s+\d{1,2},?\s+\d{4})\b/);
  return dateMatch ? dateMatch[0] : null;
}

function extractAttributes(text: string, extractedType: ExtractedType): Record<string, string | string[] | boolean | null> {
  const attrs: Record<string, string | string[] | boolean | null> = {
    situation_type: extractedType,
  };

  const timeRef = extractTimeReference(text);
  if (timeRef) attrs.time_reference = timeRef;

  if (FALL.test(text)) attrs.observable = "fall incident mentioned";
  if (APPETITE.test(text)) attrs.observable = "eating or appetite change mentioned";
  if (CONFUSION.test(text)) attrs.observable = "confusion or disorientation mentioned";
  if (INSURANCE.test(text)) attrs.observable = "insurance or financial issue mentioned";

  const clauses = text
    .split(/[.!?;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8);
  if (clauses.length > 0) attrs.extracted_clauses = clauses.slice(0, 5);

  return attrs;
}

function detectUncertainties(text: string, extractedType: ExtractedType): string[] {
  const unknowns: string[] = [];

  if (!extractTimeReference(text)) {
    unknowns.push("when this started or occurred");
  }

  if (extractedType === "incident" && !/\b(injur\w*|hurt|pain|hospital|er\b|emergency)\b/i.test(text)) {
    unknowns.push("whether any injury or medical follow-up occurred");
  }

  if (extractedType === "financial_issue" && !/\b(appeal|resubmit|call|contact)\b/i.test(text)) {
    unknowns.push("what action has been taken since the financial issue");
  }

  if (extractedType === "behavioral_change" && !/\b(since|before|after|when)\b/i.test(text)) {
    unknowns.push("what changed before this behavioral change");
  }

  if (CONFUSION.test(text) && DISCHARGE.test(text) && !/\b(since discharge|after discharge)\b/i.test(text)) {
    unknowns.push("whether confusion is linked to a recent discharge");
  }

  if (text.split(/\s+/).length < 8) {
    unknowns.push("additional context about the situation");
  }

  return [...new Set(unknowns)].slice(0, 6);
}

function highValueQuestions(uncertainties: string[]): string[] {
  if (uncertainties.length === 0) return [];
  // Generic understanding asks only — never topic keyword quizzes per uncertainty token.
  return sanitizeCaregiverFacingLines(
    [
      "Is this new compared with how they usually are?",
      "What else have you noticed alongside this?",
    ],
    2,
    { asksOnly: true },
  );
}

export function deriveTrackingDimensions(
  text: string,
  extractedType: ExtractedType,
): TrackingDimension[] {
  const dims = new Set<TrackingDimension>();

  if (FALL.test(text)) dims.add("mobility");
  if (APPETITE.test(text)) dims.add("appetite");
  if (CONFUSION.test(text)) dims.add("stability");
  if (DISCHARGE.test(text)) dims.add("recovery");
  if (INSURANCE.test(text)) dims.add("financial_stability");
  if (COORDINATION.test(text)) dims.add("coordination");
  if (APPOINTMENT.test(text) || OBLIGATION.test(text)) dims.add("administrative_status");
  if (extractedType === "observation") dims.add("daily_functioning");

  return [...dims].slice(0, 5);
}

function isGenericSignalText(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return normalized.endsWith(" signal") || normalized === "observation signal";
}

export function understoodLabel(
  text: string,
  extractedType: ExtractedType,
  sourceSnippet?: string,
): string {
  const typeLabels: Record<ExtractedType, string> = {
    incident: "Incident detected",
    observation: "Care observation noted",
    document_fact: "Document fact extracted",
    financial_issue: "Financial or administrative issue detected",
    coordination_issue: "Coordination issue detected",
    behavioral_change: "Behavioral change detected",
    administrative_issue: "Administrative issue detected",
    follow_up: "Follow-up obligation detected",
    decision: "Decision recorded",
    contact_event: "Contact event detected",
    unparsed_raw: "Raw input stored — extraction incomplete",
    unprocessed_input: "Input could not be fully processed",
    correction: "User correction applied",
    unknown: "Situation noted",
  };

  const display =
    isGenericSignalText(text) && sourceSnippet?.trim()
      ? sourceSnippet.trim()
      : text.trim();
  const clause = display.split(/[.!?]+/)[0]?.trim().slice(0, 100);
  return clause ? `${typeLabels[extractedType]}: ${clause}` : typeLabels[extractedType];
}

/** One-pass parse: structure + uncertainty only — no summary, no causal inference. */
export function parseSituationToCareEvent(params: {
  raw_input: string;
  timestamp?: string;
  source?: "user_input" | "document";
  root_event_id?: string | null;
  document_id?: string | null;
}): CanonicalCareEvent {
  const text = params.raw_input.trim();
  const extracted_type = params.source === "document" ? "document_fact" : classifyExtractedType(text);
  const ingestionTime = params.timestamp ?? new Date().toISOString();

  const source = params.source ?? "user_input";
  return withDualTime(
    {
      id: createCareEventId(),
      raw_input: text,
      extracted_type,
      entities: extractEntities(text),
      attributes: extractAttributes(text, extracted_type),
      uncertainty: detectUncertainties(text, extracted_type),
      source,
      root_event_id: params.root_event_id ?? null,
      situation_id: null,
      document_id: params.document_id ?? null,
      status: "committed",
      integrity: createIntegrityState({ confidenceScore: 0.75 }),
      priority: createStubPriority("active"),
      source_reliability: classifySourceReliability({
        source,
        raw_input: text,
      }),
    },
    text,
    ingestionTime,
  );
}

export function buildSituationUnderstanding(events: CanonicalCareEvent[]): {
  understood: UnderstoodItem[];
  uncertain: string[];
  clarification: string[];
  tracked: TrackingDimension[];
} {
  const understood: UnderstoodItem[] = events.map((e) => {
    const sourceSnippet =
      typeof e.attributes?.source_situation_text === "string"
        ? e.attributes.source_situation_text
        : undefined;
    return {
      label: understoodLabel(e.raw_input, e.extracted_type, sourceSnippet),
      extracted_type: e.extracted_type,
      event_id: e.id,
    };
  });

  const uncertain = sanitizeCaregiverFacingLines(events.flatMap((e) => e.uncertainty), 8);
  const clarification = highValueQuestions(uncertain);

  const tracked = [
    ...new Set(events.flatMap((e) => deriveTrackingDimensions(e.raw_input, e.extracted_type))),
  ];

  return { understood, uncertain, clarification, tracked };
}

/** Split document text into discrete care events (obligations, decisions, facts). */
export function parseDocumentToCareEvents(
  documentText: string,
  documentId: string,
  rootEventId: string | null,
  timestamp?: string,
): CanonicalCareEvent[] {
  const events: CanonicalCareEvent[] = [];
  const sentences = documentText
    .split(/\n+/)
    .flatMap((block) => block.split(/(?<=[.!?])\s+/))
    .map((s) => s.trim())
    .filter((s) => s.length > 15);

  const priorityPatterns = [
    /\b(follow[- ]?up|return visit|appointment|schedule)\b/i,
    /\b(prescribed|medication|dose|take)\b/i,
    /\b(diagnos\w+|condition|finding)\b/i,
    /\b(instruction|recommend|must|should|monitor)\b/i,
    /\b(discharge|admitted|visit)\b/i,
  ];

  const selected = sentences.filter((s) => priorityPatterns.some((p) => p.test(s))).slice(0, 8);

  if (selected.length === 0 && documentText.trim().length > 20) {
    selected.push(documentText.trim().slice(0, 300));
  }

  for (const sentence of selected) {
    events.push(
      parseSituationToCareEvent({
        raw_input: sentence,
        timestamp,
        source: "document",
        root_event_id: rootEventId,
        document_id: documentId,
      }),
    );
  }

  return events;
}
