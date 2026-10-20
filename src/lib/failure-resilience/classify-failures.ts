import type { DareIngestResult } from "../data-acquisition-resilience/types";
import type { CanonicalCareEvent } from "../situation-entry/types";
import { MAX_CLARIFICATION_QUESTIONS } from "./contract-constants";
import { detectGraphLinkingFailures } from "./graph-linking";
import type { FailureCategory, FailureOutcome, FailureRecord } from "./types";

function createFailureId(): string {
  return `fr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

const VAGUE_INCOMPLETE =
  /\b(isn't doing well|not doing well|things are bad|something wrong|worried about)\b/i;

function outcomeForCategory(category: FailureCategory): FailureOutcome {
  switch (category) {
    case "extraction_failure":
    case "processing_failure":
      return "preserve_raw";
    case "incomplete_context":
    case "ambiguous_interpretation":
    case "graph_linking_failure":
    case "conflicting_information":
      return "clarify";
    default:
      return "defer";
  }
}

function classifyExtractionFailures(dare: DareIngestResult): FailureRecord[] {
  const failures: FailureRecord[] = [];

  for (const section of dare.unreadable_sections) {
    failures.push({
      id: createFailureId(),
      category: "extraction_failure",
      outcome: "preserve_raw",
      message: "Extraction was incomplete — original input preserved.",
      raw_input_id: section.raw_input_id,
      event_id: null,
      extracted_partial: [],
      not_understood: [section.reason],
      clarification_questions: [
        "Can you re-upload a clearer image or type the key details manually?",
      ],
      possible_interpretations: [],
      relationship_status: null,
      conflict_id: null,
      recoverable: true,
      created_at: new Date().toISOString(),
    });
  }

  if (dare.normalization?.could_not_process) {
    const partial =
      dare.validated_events.length > 0
        ? dare.validated_events.map((v) => v.extracted_fact)
        : dare.candidates.slice(0, 3).map((c) => c.extracted_fact);

    failures.push({
      id: createFailureId(),
      category: "extraction_failure",
      outcome: "preserve_raw",
      message: "Could not fully extract structured information from this input.",
      raw_input_id: dare.raw_input.id,
      event_id: null,
      extracted_partial: partial,
      not_understood: dare.candidates.flatMap((c) => c.missing_fields).slice(0, 5),
      clarification_questions: dare.disambiguation_questions
        .map((q) => q.question)
        .slice(0, MAX_CLARIFICATION_QUESTIONS),
      possible_interpretations: [],
      relationship_status: null,
      conflict_id: null,
      recoverable: true,
      created_at: new Date().toISOString(),
    });
  }

  const lowOcr =
    dare.raw_input.ocr_confidence !== null && dare.raw_input.ocr_confidence < 0.5;
  if (lowOcr && dare.validated_events.length === 0) {
    failures.push({
      id: createFailureId(),
      category: "extraction_failure",
      outcome: "preserve_raw",
      message: "Poor OCR quality — raw document preserved for manual review.",
      raw_input_id: dare.raw_input.id,
      event_id: null,
      extracted_partial: [dare.raw_input.content.slice(0, 120)],
      not_understood: ["Document text could not be reliably read"],
      clarification_questions: ["Can you confirm or re-enter the key details from this document?"],
      possible_interpretations: [],
      relationship_status: null,
      conflict_id: null,
      recoverable: true,
      created_at: new Date().toISOString(),
    });
  }

  return failures;
}

function classifyIncompleteContext(
  dare: DareIngestResult | null,
  events: CanonicalCareEvent[],
  rawInput: string,
): FailureRecord[] {
  const failures: FailureRecord[] = [];

  for (const uncertain of dare?.uncertain_events ?? []) {
    failures.push({
      id: createFailureId(),
      category: "incomplete_context",
      outcome: "clarify",
      message: "This was understood, but a few details would help complete the record.",
      raw_input_id: uncertain.raw_input_id,
      event_id: events.find((e) => e.raw_input.includes(uncertain.label))?.id ?? null,
      extracted_partial: [uncertain.label],
      not_understood: uncertain.missing_fields,
      clarification_questions: uncertain.missing_fields.map((f) => `What is the ${f.replace(/_/g, " ")}?`),
      possible_interpretations: [],
      relationship_status: "independent",
      conflict_id: null,
      recoverable: true,
      created_at: new Date().toISOString(),
    });
  }

  const trimmed = rawInput.trim();
  if (
    trimmed &&
    (VAGUE_INCOMPLETE.test(trimmed) || trimmed.split(/\s+/).length <= 8) &&
    events.every((e) => e.status === "provisional" || e.status === "unparsed_raw")
  ) {
    failures.push({
      id: createFailureId(),
      category: "incomplete_context",
      outcome: "clarify",
      message: "Added to the record — a little more detail would strengthen continuity.",
      raw_input_id: dare?.raw_input.id ?? null,
      event_id: events[0]?.id ?? null,
      extracted_partial: [trimmed],
      not_understood: ["Specific symptoms", "Timeline", "What changed"],
      clarification_questions: [
        "What specifically changed?",
        "When did you first notice this?",
        "Is there an appointment, diagnosis, or medication involved?",
      ].slice(0, MAX_CLARIFICATION_QUESTIONS),
      possible_interpretations: [],
      relationship_status: "independent",
      conflict_id: null,
      recoverable: true,
      created_at: new Date().toISOString(),
    });
  }

  return failures;
}

function classifyAmbiguousInterpretation(dare: DareIngestResult): FailureRecord[] {
  const failures: FailureRecord[] = [];

  for (const q of dare.disambiguation_questions) {
    failures.push({
      id: createFailureId(),
      category: "ambiguous_interpretation",
      outcome: "clarify",
      message: "Multiple valid interpretations exist — graph update deferred until confirmed.",
      raw_input_id: dare.raw_input.id,
      event_id: null,
      extracted_partial: dare.candidates
        .filter((c) => q.related_candidate_ids.includes(c.id))
        .map((c) => c.extracted_fact),
      not_understood: q.ambiguity_flags.map((f) => f.replace(/_/g, " ")),
      clarification_questions: [q.question],
      possible_interpretations: dare.candidates
        .filter((c) => q.related_candidate_ids.includes(c.id))
        .map((c) => c.extracted_fact),
      relationship_status: "deferred",
      conflict_id: null,
      recoverable: true,
      created_at: new Date().toISOString(),
    });
  }

  for (const c of dare.candidates) {
    if (c.ambiguity_flags.length > 0 && !dare.disambiguation_questions.some((q) => q.related_candidate_ids.includes(c.id))) {
      failures.push({
        id: createFailureId(),
        category: "ambiguous_interpretation",
        outcome: "clarify",
        message: "Ambiguous language detected — please confirm the intended meaning.",
        raw_input_id: c.raw_input_id,
        event_id: null,
        extracted_partial: [c.extracted_fact],
        not_understood: c.ambiguity_flags.map((f) => f.replace(/_/g, " ")),
        clarification_questions: [`Can you clarify: "${c.extracted_fact}"?`],
        possible_interpretations: [c.extracted_fact],
        relationship_status: "deferred",
        conflict_id: null,
        recoverable: true,
        created_at: new Date().toISOString(),
      });
    }
  }

  return failures;
}

function classifyConflicts(dare: DareIngestResult): FailureRecord[] {
  return dare.conflicts.map((conflict) => ({
    id: createFailureId(),
    category: "conflicting_information" as const,
    outcome: "clarify" as const,
    message: "New information may contradict existing records — both preserved until resolved.",
    raw_input_id: conflict.claims[0]?.source_raw_input_id ?? null,
    event_id: null,
    extracted_partial: conflict.claims.map((c) => c.claim),
    not_understood: [`Conflicting ${conflict.event_signal.replace(/_/g, " ")} claims`],
    clarification_questions: [
      `Which is correct for ${conflict.event_signal.replace(/_/g, " ")}?`,
      ...conflict.claims.map((c) => `Claim: ${c.claim}${c.date_reference ? ` (${c.date_reference})` : ""}`),
    ].slice(0, MAX_CLARIFICATION_QUESTIONS),
    possible_interpretations: conflict.claims.map((c) => c.claim),
    relationship_status: "unresolved" as const,
    conflict_id: conflict.id,
    recoverable: true,
    created_at: new Date().toISOString(),
  }));
}

function classifyProcessingFailure(
  rawInput: string,
  errorMessage: string | null | undefined,
  dare: DareIngestResult | null,
): FailureRecord[] {
  if (!errorMessage && dare) return [];
  if (!rawInput.trim() && !errorMessage) return [];

  return [
    {
      id: createFailureId(),
      category: "processing_failure",
      outcome: "defer",
      message: "Processing is pending — your submission is preserved and will retry automatically.",
      raw_input_id: dare?.raw_input.id ?? null,
      event_id: null,
      extracted_partial: rawInput.trim() ? [rawInput.slice(0, 200)] : [],
      not_understood: errorMessage ? [errorMessage] : ["Internal processing incomplete"],
      clarification_questions: [],
      possible_interpretations: [],
      relationship_status: null,
      conflict_id: null,
      recoverable: true,
      created_at: new Date().toISOString(),
    },
  ];
}

export function classifyFailures(input: {
  dare: DareIngestResult | null;
  events_created: CanonicalCareEvent[];
  prior_events: CanonicalCareEvent[];
  raw_input: string;
  processing_error?: string | null;
}): FailureRecord[] {
  const all: FailureRecord[] = [];

  if (input.dare) {
    all.push(...classifyExtractionFailures(input.dare));
    all.push(...classifyIncompleteContext(input.dare, input.events_created, input.raw_input));
    all.push(...classifyAmbiguousInterpretation(input.dare));
    all.push(...classifyConflicts(input.dare));
  } else if (input.raw_input.trim()) {
    all.push(...classifyIncompleteContext(null, input.events_created, input.raw_input));
  }

  all.push(
    ...detectGraphLinkingFailures(input.events_created, input.prior_events),
  );

  all.push(
    ...classifyProcessingFailure(input.raw_input, input.processing_error, input.dare),
  );

  const seen = new Set<string>();
  return all.filter((f) => {
    const key = `${f.category}:${f.message}:${f.event_id ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function countOutcomes(failures: FailureRecord[]): Record<FailureOutcome, number> {
  const counts: Record<FailureOutcome, number> = { clarify: 0, preserve_raw: 0, defer: 0 };
  for (const f of failures) {
    counts[f.outcome] += 1;
  }
  return counts;
}

export function deriveProcessingStatus(
  failures: FailureRecord[],
  events: CanonicalCareEvent[],
): import("./types").ProcessingStatus {
  if (failures.some((f) => f.category === "processing_failure")) return "pending";
  if (failures.length === 0 && events.every((e) => e.status === "committed")) return "complete";
  if (events.some((e) => e.status === "unparsed_raw")) return "partial";
  if (events.some((e) => e.status === "provisional")) return "partial";
  if (failures.length > 0) return "partial";
  return "complete";
}
