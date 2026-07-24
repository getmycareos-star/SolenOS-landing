import { extractFactsOnly, formatSituationSummary } from "../risk-uncertainty-engine/extract-facts";
import { checkInformationCompleteness } from "../risk-uncertainty-engine/completeness-check";
import {
  classifyJourneyEventType,
  inferClinicalImportance,
  journeyCategoryFromType,
} from "./classify-event";
import type { IngestJourneyInputParams, JourneyGraphEvent, ResolvedStatus } from "./types";

const DR_PATTERN = /\bDr\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g;
const LOCATION_PATTERN = /\b(bathroom|bedroom|kitchen|hospital|clinic|home|nursing home)\b/i;

function extractPeople(content: string): string[] {
  const people = new Set<string>();
  for (const match of content.matchAll(DR_PATTERN)) {
    people.add(match[0].trim());
  }
  return [...people];
}

function extractLocation(content: string): string | null {
  const match = content.match(LOCATION_PATTERN);
  return match ? match[0] : null;
}

function buildTitle(description: string, eventType: string): string {
  const first = description.split(/[.!?]+/)[0]?.trim();
  if (first && first.length <= 80) return first;
  return first ? `${first.slice(0, 77)}…` : eventType.replace(/_/g, " ");
}

function inferOpenQuestions(
  completenessMissing: string[],
  eventType: string,
): string[] {
  void eventType;
  // Never kind-template quizzes (fall → injury, symptom → when). Gaps only.
  return completenessMissing.map((m) => `Can you clarify: ${m}?`).slice(0, 5);
}

export function structureJourneyEvent(params: {
  input: IngestJourneyInputParams;
  journey_id: string;
  event_id: string;
  related_event_ids?: string[];
  open_questions?: string[];
  resolved_status?: ResolvedStatus;
}): JourneyGraphEvent {
  const description = params.input.description.trim();
  const eventType = classifyJourneyEventType(description);
  const now = new Date().toISOString();
  const caregiverId = params.input.caregiver_id ?? "default_caregiver";

  return {
    id: params.event_id,
    journey_id: params.journey_id,
    caregiver_id: caregiverId,
    case_id: params.input.case_id ?? null,
    event_type: eventType,
    timestamp: params.input.timestamp ?? now,
    description,
    people_involved: extractPeople(description),
    location: extractLocation(description),
    evidence: {
      source: params.input.source ?? "caregiver_observation",
      document_ids: params.input.attachments?.map((a) => a.id),
    },
    related_event_ids: params.related_event_ids ?? [],
    clinical_importance: inferClinicalImportance(eventType, description),
    open_questions: params.open_questions ?? [],
    resolved_status: params.resolved_status ?? "open",
    source: params.input.source ?? "caregiver",
    category: journeyCategoryFromType(eventType),
    title: buildTitle(description, eventType),
    attachments: params.input.attachments ?? [],
    metadata: params.input.metadata ?? {},
    created_at: now,
  };
}

export function extractPipelineFacts(input: string): {
  facts_only_summary: string;
  completeness_status: "COMPLETE" | "PARTIALLY_COMPLETE" | "INSUFFICIENT";
  missing_signals: string[];
} {
  const facts = extractFactsOnly(input);
  const completeness = checkInformationCompleteness(input);
  return {
    facts_only_summary: formatSituationSummary(facts),
    completeness_status: completeness.status,
    missing_signals: completeness.missing_signals,
  };
}
