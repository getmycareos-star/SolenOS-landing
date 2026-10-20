import { applyRepeatedSignalBoost } from "./confidence-evolution";

import { reconcileCrossDocument } from "./cross-document-reconcile";

import { classifySourceReliability } from "../continuity-properties/source-reliability";

import {

  buildUncertainEvents,

  checkOcrFailure,

  extractCandidatesFromRawInput,

  generateDisambiguationQuestions,

} from "./extract-candidates";

import {

  normalizeEvents,

  type NormalizedAtomicEvent,

} from "../event-normalization";

import {

  listConflictsForCaregiver,

  listCorrectionsForCaregiver,

  listUncertainForCaregiver,

  listValidatedForCaregiver,

  storeCandidates,

  storeUncertainEvents,

  createValidatedEventId,

  storeValidatedEvent,

} from "./projection-store";

import { createRawInputId, storeRawInput } from "./raw-input-store";

import { resetNormalizationStore } from "../event-normalization";
import { resetDareProjectionStore } from "./projection-store";
import { resetRawInputStore } from "./raw-input-store";
import type { EventTime } from "../time-model/types";
import { parseEventTimeFromText, temporalSortKey } from "../time-model";
import {
  createIntegrityState,
  resolveLifecycleFromValidated,
} from "../care-event-integrity";
import { createStubPriority, mapLifecycleToAttentionStatus } from "../care-event-priority";

import type {

  DareIngestResult,

  DareProjection,

  RawInput,

  RawInputType,

  ValidatedCareEvent,

} from "./types";



export type IngestRawInputParams = {

  caregiver_id?: string;

  content: string;

  input_type?: RawInputType;

  ocr_confidence?: number | null;

  document_id?: string | null;

  document_name?: string | null;

  captured_at?: string;

};



function normalizedToValidated(

  event: NormalizedAtomicEvent,

  caregiverId: string,

  documentId: string | null,

): ValidatedCareEvent {

  return {

    id: createValidatedEventId(),

    raw_input_id: event.raw_input_id,

    candidate_id: event.candidate_id ?? event.id,

    extracted_fact: event.label,

    event_signal: event.atomic_type,

    confidence_score: event.confidence,

    confidence_sources: ["nlp_model"],

    validated_at: event.ingestion_time,

    validation_method: event.needs_review ? "auto_threshold" : "auto_threshold",

    entities: event.entities.map((e) => ({ kind: "person", label: e })),

    attributes: {

      ...event.attributes,

      atomic_type: event.atomic_type,

      needs_review: event.needs_review,

      status: event.status,

      uncertainty_lifecycle: event.uncertainty,

      attached_fragments: event.attached_fragments,

      merged_from_ids: event.merged_from_ids,

      event_time: event.event_time,

      ingestion_time: event.ingestion_time,

    },

    document_id: documentId,

  };

}



/**

 * DARE ingestion pipeline:

 * RawInput → Pre-normalize → Extract → Normalize → Commit OR Quarantine

 */

export function ingestRawInput(params: IngestRawInputParams): DareIngestResult {

  const caregiverId = params.caregiver_id ?? "default_caregiver";

  const now = params.captured_at ?? new Date().toISOString();



  const rawInput: RawInput = {

    id: createRawInputId(),

    caregiver_id: caregiverId,

    input_type: params.input_type ?? "text",

    content: params.content.trim(),

    ocr_confidence: params.ocr_confidence ?? null,

    document_id: params.document_id ?? null,

    document_name: params.document_name ?? null,

    captured_at: now,

    metadata: {},

  };



  storeRawInput(rawInput);



  const unreadable = checkOcrFailure(rawInput);

  const unreadable_sections = unreadable ? [unreadable] : [];



  if (unreadable?.reason === "low_ocr_confidence" || unreadable?.reason === "empty_content") {

    const normalization = normalizeEvents({

      caregiver_id: caregiverId,

      raw_input_id: rawInput.id,

      content: rawInput.content,

      input_type: rawInput.input_type,

      candidates: [],

      ocr_failed: true,

      failure_reason: unreadable.reason,

      timestamp: now,

    });



    return {

      raw_input: rawInput,

      candidates: [],

      uncertain_events: [],

      unreadable_sections,

      disambiguation_questions: [

        {

          question_id: `dq_unprocessed_${rawInput.id}`,

          question_type: "disambiguation",

          priority: "high",

          question: normalization.clarification_question ?? "What is this about?",

          related_candidate_ids: [],

          ambiguity_flags: ["ocr_unreadable"],

        },

      ],

      conflicts: [],

      validated_events: [],

      provisional_count: 1,

      normalization,

    };

  }



  let candidates = extractCandidatesFromRawInput(rawInput);

  const priorValidated = listValidatedForCaregiver(caregiverId);



  candidates = candidates.map((c) => {

    const boosted = applyRepeatedSignalBoost(c, priorValidated);

    return { ...c, confidence: boosted.confidence, confidence_sources: boosted.sources };

  });



  storeCandidates(candidates, caregiverId);



  const normalization = normalizeEvents({

    caregiver_id: caregiverId,

    raw_input_id: rawInput.id,

    content: rawInput.content,

    input_type: rawInput.input_type,

    candidates,

    timestamp: now,

  });



  const uncertain_events = buildUncertainEvents(candidates, rawInput.id);

  storeUncertainEvents(uncertain_events);



  const disambiguation_questions = generateDisambiguationQuestions(candidates);

  if (normalization.clarification_question) {

    disambiguation_questions.unshift({

      question_id: `dq_norm_${rawInput.id}`,

      question_type: "disambiguation",

      priority: "high",

      question: normalization.clarification_question,

      related_candidate_ids: normalization.quarantined.map((q) => q.candidate_id).filter(Boolean) as string[],

      ambiguity_flags: ["partial_signal"],

    });

  }



  const conflicts = reconcileCrossDocument(caregiverId, candidates, [rawInput]);



  const validated_events: ValidatedCareEvent[] = [];



  for (const event of [...normalization.committed, ...normalization.needs_review]) {

    const inConflict = conflicts.some((conf) =>

      conf.claims.some(

        (claim) => claim.source_raw_input_id === event.raw_input_id && claim.claim === event.source_text,

      ),

    );

    if (inConflict) continue;



    const validated = normalizedToValidated(event, caregiverId, rawInput.document_id);

    storeValidatedEvent(validated, caregiverId);

    validated_events.push(validated);

  }



  const provisional_count =

    normalization.quarantined.length +

    uncertain_events.length +

    unreadable_sections.length +

    (normalization.could_not_process ? 1 : 0);



  return {

    raw_input: rawInput,

    candidates,

    uncertain_events,

    unreadable_sections,

    disambiguation_questions,

    conflicts,

    validated_events,

    provisional_count,

    normalization,

  };

}



export function getDareProjection(caregiverId: string): DareProjection {

  return {

    validated_events: listValidatedForCaregiver(caregiverId),

    uncertain_events: listUncertainForCaregiver(caregiverId),

    pending_questions: [],

    unresolved_conflicts: listConflictsForCaregiver(caregiverId),

    corrections: listCorrectionsForCaregiver(caregiverId),

  };

}



export { applyCorrection, confirmCandidate } from "./corrections";



export function resetDareStore(): void {

  resetRawInputStore();

  resetDareProjectionStore();

  resetNormalizationStore();

}



/** Map validated DARE events to situation-entry CanonicalCareEvent shape. */

export function validatedToCanonical(

  event: ValidatedCareEvent,

): import("../situation-entry/types").CanonicalCareEvent {

  const typeMap: Record<string, import("../situation-entry/types").ExtractedType> = {

    possible_fall: "incident",

    incident_occurred: "incident",

    financial_issue_signal: "financial_issue",

    financial_claim_rejected: "financial_issue",

    health_deterioration_signal: "behavioral_change",

    possible_medication_change: "observation",

    medication_started: "observation",

    medication_changed: "observation",

    follow_up_signal: "follow_up",

    care_instruction_given: "follow_up",

    observation_signal: "observation",

    appetite_change_signal: "observation",

    symptom_observed: "observation",

    appointment_occurred: "observation",

    document_received: "document_fact",

    communication_occurred: "contact_event",

    contact_event: "contact_event",

    unprocessed_input: "unparsed_raw",

    correction: "decision",

  };



  const atomicType = String(event.attributes.atomic_type ?? event.event_signal);



  const ingestion_time = String(event.attributes.ingestion_time ?? event.validated_at);

  const storedEventTime = event.attributes.event_time as EventTime | undefined;

  const { event_time } = storedEventTime

    ? { event_time: storedEventTime }

    : parseEventTimeFromText(event.extracted_fact, ingestion_time);

  const timestamp = temporalSortKey(event_time, ingestion_time);

  const normStatus = String(event.attributes.status ?? "committed");
  const status = resolveLifecycleFromValidated({
    confidenceScore: event.confidence_score,
    normStatus,
    validationMethod: event.validation_method,
  });

  const integrity = createIntegrityState({
    confidenceScore: event.confidence_score,
    userConfirmed: event.validation_method === "user_confirmation",
    originalExtraction: event.extracted_fact,
    sources:
      event.validation_method === "user_confirmation"
        ? ["user_correction"]
        : event.document_id
          ? ["validated_document", "ai_inference"]
          : ["ai_inference"],
  });

  return {

    id: event.id,

    timestamp,

    event_time,

    ingestion_time,

    raw_input: event.extracted_fact,

    extracted_type: typeMap[atomicType] ?? typeMap[event.event_signal] ?? "observation",

    entities: event.entities.map((e) => ({

      kind: (e.kind as "person" | "place" | "institution" | "object") ?? "person",

      label: e.label,

    })),

    attributes: Object.fromEntries(

      Object.entries(event.attributes).map(([k, v]) => [

        k,

        typeof v === "string" || typeof v === "boolean" || v === null

          ? v

          : Array.isArray(v)

            ? v.map(String)

            : String(v),

      ]),

    ),

    uncertainty: Array.isArray(event.attributes.missing_fields)

      ? (event.attributes.missing_fields as string[])

      : [],

    source: event.document_id ? "document" : "user_input",

    root_event_id: null,

    situation_id: null,

    document_id: event.document_id,

    status,

    integrity,

    priority: createStubPriority(mapLifecycleToAttentionStatus(status)),

    source_reliability: (() => {
      const source = event.document_id ? "document" as const : "user_input" as const;
      return classifySourceReliability({
        source,
        raw_input: event.extracted_fact,
      });
    })(),

  };

}


