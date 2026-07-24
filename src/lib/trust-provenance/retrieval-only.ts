import {
  GENERATION_ALLOWED,
  GENERATION_FORBIDDEN,
  INSUFFICIENT_EVIDENCE_MESSAGE,
  RETRIEVAL_PIPELINE_STEPS,
} from "./contract-constants";
import type { DareIngestResult } from "../data-acquisition-resilience/types";
import type { CanonicalCareEvent } from "../situation-entry/types";
import { getAuditTrailForEvent } from "../care-event-integrity";
import type {
  GenerationBoundaries,
  RetrievalContextSnapshot,
  RetrievalPipelineStep,
} from "./types";

export function buildRetrievalContext(input: {
  events: CanonicalCareEvent[];
  dare: DareIngestResult | null;
  unresolved_questions: string[];
  min_evidence_for_answer?: number;
}): RetrievalContextSnapshot {
  const care_event_ids = input.events
    .filter((e) => e.status !== "invalidated" && e.status !== "superseded")
    .map((e) => e.id);

  const document_ids = [
    ...new Set(
      input.events
        .map((e) => e.document_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  if (input.dare?.raw_input.document_id && !document_ids.includes(input.dare.raw_input.document_id)) {
    document_ids.push(input.dare.raw_input.document_id);
  }

  const correction_ids: string[] = [];
  for (const eventId of care_event_ids) {
    for (const audit of getAuditTrailForEvent(eventId)) {
      correction_ids.push(audit.id);
    }
  }

  const unresolved_uncertainties = [
    ...input.unresolved_questions,
    ...input.events.flatMap((e) => e.uncertainty),
    ...(input.dare?.disambiguation_questions.map((q) => q.question) ?? []),
  ];

  const minEvidence = input.min_evidence_for_answer ?? 1;
  const sufficient_for_answer =
    care_event_ids.length >= minEvidence &&
    !input.events.every((e) => e.status === "unparsed_raw");

  return {
    pipeline_steps: [...RETRIEVAL_PIPELINE_STEPS],
    care_event_ids,
    document_ids,
    correction_ids,
    unresolved_uncertainties: [...new Set(unresolved_uncertainties)],
    sufficient_for_answer,
  };
}

export function buildGenerationBoundaries(): GenerationBoundaries {
  return {
    allowed: [...GENERATION_ALLOWED],
    forbidden: [...GENERATION_FORBIDDEN],
    retrieval_only: true,
  };
}

export type RetrievalOnlyResult = {
  retrieval_context: RetrievalContextSnapshot;
  generation_boundaries: GenerationBoundaries;
  may_generate: boolean;
  response: string | null;
  evidence: string[];
  reasoning: string[];
  uncertainty: string[];
};

/**
 * Retrieval-only generation pipeline.
 * Retrieve → documents → corrections → uncertainties → generate from context only.
 */
export function runRetrievalOnlyGeneration(input: {
  events: CanonicalCareEvent[];
  dare: DareIngestResult | null;
  unresolved_questions: string[];
  question?: string;
}): RetrievalOnlyResult {
  const retrieval_context = buildRetrievalContext({
    events: input.events,
    dare: input.dare,
    unresolved_questions: input.unresolved_questions,
  });

  const generation_boundaries = buildGenerationBoundaries();

  const evidence = retrieval_context.care_event_ids.map((id) => {
    const event = input.events.find((e) => e.id === id);
    return event ? event.raw_input.slice(0, 100) : id;
  });

  const uncertainty = retrieval_context.unresolved_uncertainties;
  const reasoning: string[] = [];

  for (const event of input.events.filter((e) => retrieval_context.care_event_ids.includes(e.id))) {
    reasoning.push(`${event.extracted_type.replace(/_/g, " ")}: ${event.raw_input.slice(0, 80)}`);
  }

  if (!retrieval_context.sufficient_for_answer) {
    return {
      retrieval_context,
      generation_boundaries,
      may_generate: false,
      response: INSUFFICIENT_EVIDENCE_MESSAGE,
      evidence,
      reasoning,
      uncertainty,
    };
  }

  const responseParts = [
    input.question ? `Regarding: ${input.question}` : null,
    evidence.length > 0 ? `Based on ${evidence.length} validated CareEvent(s):` : null,
    ...reasoning.slice(0, 5),
    uncertainty.length > 0 ? `Unresolved: ${uncertainty.slice(0, 3).join("; ")}` : null,
  ].filter(Boolean);

  return {
    retrieval_context,
    generation_boundaries,
    may_generate: true,
    response: responseParts.join("\n"),
    evidence,
    reasoning,
    uncertainty,
  };
}

export function assertRetrievalPipelineOrder(steps: RetrievalPipelineStep[]): boolean {
  const expected = [...RETRIEVAL_PIPELINE_STEPS];
  return steps.length === expected.length && steps.every((s, i) => s === expected[i]);
}
