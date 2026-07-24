import { parseEventTimeFromText, temporalSortKey, createIngestionTime } from "../time-model";
import type { CanonicalCareEvent } from "../situation-entry/types";
import type { UncertainEventCandidate } from "../data-acquisition-resilience/types";
import type { RawInput } from "../data-acquisition-resilience/types";
import { withDualTime } from "../situation-entry/dual-time";
import { appendAuditEntry } from "./audit-store";
import {
  createIntegrityState,
  mapNormalizationStatusToLifecycle,
} from "./lifecycle";
import type { CareEventLifecycleStatus } from "./types";
import { createStubPriority, mapLifecycleToAttentionStatus } from "../care-event-priority";
import { classifySourceReliability } from "../continuity-properties/source-reliability";

function createCareEventId(): string {
  return `ce_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Extraction failure — store raw input as unparsed_raw event (no data loss). */
export function buildUnparsedRawEvent(params: {
  rawInput: RawInput;
  reason: string;
  caregiverId: string;
}): CanonicalCareEvent {
  const content = params.rawInput.content.trim() || "[empty input]";
  const ingestionTime = createIngestionTime(params.rawInput.captured_at);

  const event = withDualTime(
    {
      id: createCareEventId(),
      raw_input: content,
      extracted_type: "unparsed_raw",
      entities: [],
      attributes: {
        failure_reason: params.reason,
        raw_input_id: params.rawInput.id,
        ocr_confidence: params.rawInput.ocr_confidence != null ? String(params.rawInput.ocr_confidence) : null,
      },
      uncertainty: ["extraction_failed", "needs_clarification"],
      source: params.rawInput.document_id ? "document" : "user_input",
      root_event_id: null,
      situation_id: null,
      document_id: params.rawInput.document_id,
      status: "unparsed_raw" as CareEventLifecycleStatus,
      integrity: createIntegrityState({
        confidenceScore: 0,
        originalExtraction: content,
        sources: ["ai_inference"],
      }),
      priority: createStubPriority("provisional"),
      source_reliability: classifySourceReliability({
        source: params.rawInput.document_id ? "document" : "user_input",
        raw_input: content,
      }),
    },
    content,
    ingestionTime,
  );

  const audit = appendAuditEntry({
    event_id: event.id,
    caregiver_id: params.caregiverId,
    action: "create_unparsed",
    updated_snapshot: { raw_input: content, reason: params.reason },
    reason: params.reason,
    user_source: "system",
  });

  return {
    ...event,
    integrity: { ...event.integrity, audit_trail_ids: [audit.id] },
    priority: createStubPriority("provisional"),
  };
}
function isGenericSignalLabel(label: string): boolean {
  const normalized = label.trim().toLowerCase();
  return (
    normalized.endsWith(" signal") ||
    normalized === "observation signal" ||
    normalized === "health deterioration signal" ||
    normalized === "follow up signal" ||
    normalized === "financial issue signal"
  );
}

export function buildProvisionalEvent(params: {
  uncertain: UncertainEventCandidate;
  rawInput: RawInput;
  caregiverId: string;
}): CanonicalCareEvent {
  const userText = params.rawInput.content.trim();
  const label =
    isGenericSignalLabel(params.uncertain.label) && userText
      ? userText.slice(0, 300)
      : params.uncertain.label;
  const ingestionTime = createIngestionTime(params.rawInput.captured_at);
  const { event_time } = parseEventTimeFromText(label, ingestionTime);

  const extractedType =
    params.uncertain.event_signal === "contact_event"
      ? "contact_event"
      : params.uncertain.event_signal === "possible_fall"
        ? "incident"
        : "observation";

  const event = withDualTime(
    {
      id: createCareEventId(),
      raw_input: label,
      extracted_type: extractedType,
      entities: [],
      attributes: {
        provisional_reason: params.uncertain.reason,
        raw_input_id: params.rawInput.id,
        event_signal: params.uncertain.event_signal,
      },
      uncertainty: [
        ...params.uncertain.missing_fields,
        ...params.uncertain.ambiguity.map((a) => a.replace(/_/g, " ")),
      ],
      source: params.rawInput.document_id ? "document" : "user_input",
      root_event_id: null,
      situation_id: null,
      document_id: params.rawInput.document_id,
      status: "provisional" as CareEventLifecycleStatus,
      integrity: createIntegrityState({
        confidenceScore: 0.45,
        originalExtraction: label,
      }),
      priority: createStubPriority("provisional"),
      source_reliability: classifySourceReliability({
        source: params.rawInput.document_id ? "document" : "user_input",
        raw_input: label,
      }),
    },
    label,
    ingestionTime,
  );

  event.timestamp = temporalSortKey(event_time, ingestionTime);

  const audit = appendAuditEntry({
    event_id: event.id,
    caregiver_id: params.caregiverId,
    action: "create_provisional",
    updated_snapshot: { label, reason: params.uncertain.reason },
    reason: params.uncertain.reason,
    user_source: "system",
  });

  return {
    ...event,
    integrity: { ...event.integrity, audit_trail_ids: [audit.id] },
    priority: createStubPriority("provisional"),
  };
}

export function resolveLifecycleFromValidated(params: {
  confidenceScore: number;
  normStatus?: string;
  validationMethod?: string;
}): CareEventLifecycleStatus {
  if (params.validationMethod === "user_confirmation") return "committed";
  if (params.normStatus) {
    return mapNormalizationStatusToLifecycle(
      params.normStatus as import("../event-normalization/types").EventStatus,
      params.confidenceScore,
    );
  }
  if (params.confidenceScore < 0.65) return "provisional";
  return "committed";
}
