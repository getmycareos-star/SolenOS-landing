import type { ExtractionCandidate } from "../data-acquisition-resilience/types";
import { attachNoiseToParent, isNoiseFragment } from "./atomicity-rules";
import { classifyConfidenceTier, tierToStatus } from "./confidence-tiers";
import { deduplicateEvents } from "./deduplicate";
import { withNormalizedDualTime } from "./dual-time";
import { preNormalizeText } from "./pre-normalize";
import { hasMultipleActions, splitCompositeInput } from "./split-composite";
import { applyMedicationUpdateRule } from "./update-existing";
import { createUncertainty } from "./uncertainty-lifecycle";
import type {
  AtomicEventType,
  NormalizationAction,
  NormalizationResult,
  NormalizedAtomicEvent,
} from "./types";

const committedStore = new Map<string, NormalizedAtomicEvent[]>();

export function createNormalizedEventId(): string {
  return `nae_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function getCommittedEvents(caregiverId: string): NormalizedAtomicEvent[] {
  return committedStore.get(caregiverId) ?? [];
}

export function storeCommittedEvents(caregiverId: string, events: NormalizedAtomicEvent[]): void {
  const existing = committedStore.get(caregiverId) ?? [];
  const byId = new Map(existing.map((e) => [e.id, e]));
  for (const e of events) byId.set(e.id, e);
  committedStore.set(caregiverId, [...byId.values()]);
}

export function resetNormalizationStore(): void {
  committedStore.clear();
}

function extractEntities(text: string): string[] {
  const entities: string[] = [];
  for (const m of text.matchAll(/\b(mom|dad|mother|father|parent|patient)\b/gi)) {
    entities.push(m[0].toLowerCase());
  }
  return [...new Set(entities)];
}

function candidatesToAtomic(
  candidates: ExtractionCandidate[],
  normalizedText: string,
  rawInputId: string,
  timestamp: string,
): NormalizedAtomicEvent[] {
  const events: NormalizedAtomicEvent[] = [];

  if (hasMultipleActions(normalizedText)) {
    const splits = splitCompositeInput(normalizedText);
    for (const split of splits) {
      const noise = isNoiseFragment(split.clause);
      if (noise.noise) continue;

      const match = candidates.find((c) => c.source_span.includes(split.clause.slice(0, 20)));
      const confidence = match?.confidence ?? 0.7;
      const dual = withNormalizedDualTime(split.clause, timestamp);

      events.push({
        id: createNormalizedEventId(),
        atomic_type: split.atomic_type,
        label: split.clause,
        source_text: split.clause,
        confidence,
        confidence_tier: classifyConfidenceTier(confidence),
        status: tierToStatus(classifyConfidenceTier(confidence)),
        entities: extractEntities(split.clause),
        attributes: { split_from_composite: true },
        uncertainty: (match?.missing_fields ?? []).map(createUncertainty),
        attached_fragments: [],
        merged_from_ids: [],
        updated_event_id: null,
        raw_input_id: rawInputId,
        candidate_id: match?.id ?? null,
        timestamp: dual.timestamp,
        event_time: dual.event_time,
        ingestion_time: dual.ingestion_time,
        needs_review: confidence < 0.85 && confidence >= 0.65,
      });
    }
    return events;
  }

  for (const c of candidates) {
    const noise = isNoiseFragment(c.source_span);
    if (noise.noise && noise.attach_to) {
      const attached = attachNoiseToParent(c.source_span, noise.attach_to, events);
      if (attached) {
        const idx = events.findIndex((e) => e.id === attached.id);
        if (idx >= 0) events[idx] = attached;
        continue;
      }
    }
    if (noise.noise && noise.merge_into) {
      const existing = events.find((e) => e.atomic_type === noise.merge_into);
      if (existing) {
        existing.merged_from_ids.push(c.id);
        existing.attached_fragments.push(c.source_span);
        continue;
      }
    }

    const atomicType = mapSignalToAtomic(c.event_signal, c.source_span);
    const tier = classifyConfidenceTier(c.confidence);
    const dual = withNormalizedDualTime(c.source_span, timestamp);

    events.push({
      id: createNormalizedEventId(),
      atomic_type: atomicType,
      label: c.extracted_fact,
      source_text: c.source_span,
      confidence: c.confidence,
      confidence_tier: tier,
      status: tierToStatus(tier),
      entities: extractEntities(c.source_span),
      attributes: {
        completeness: c.completeness,
        ambiguity_flags: c.ambiguity_flags,
      },
      uncertainty: c.missing_fields.map(createUncertainty),
      attached_fragments: [],
      merged_from_ids: [],
      updated_event_id: null,
      raw_input_id: rawInputId,
      candidate_id: c.id,
      timestamp: dual.timestamp,
      event_time: dual.event_time,
      ingestion_time: dual.ingestion_time,
      needs_review: tier === "needs_review",
    });
  }

  return events;
}

function mapSignalToAtomic(signal: string, text: string): AtomicEventType {
  if (signal === "possible_fall") return "incident_occurred";
  if (signal === "financial_issue_signal") return "financial_claim_rejected";
  if (signal === "possible_medication_change") return "medication_changed";
  if (signal === "follow_up_signal") return "care_instruction_given";
  if (/\b(received|document|letter|form)\b/i.test(text)) return "document_received";
  if (/\b(called|phone)\b/i.test(text)) return "communication_occurred";
  if (/\b(started|prescribed)\b/i.test(text)) return "medication_started";
  if (/\b(appointment|visit|hospital)\b/i.test(text)) return "appointment_occurred";
  return "symptom_observed";
}

export function createUnprocessedEvent(params: {
  rawInputId: string;
  reason: string;
  timestamp: string;
  sourcePreview?: string;
}): NormalizedAtomicEvent {
  const dual = withNormalizedDualTime(params.sourcePreview ?? "", params.timestamp);
  return {
    id: createNormalizedEventId(),
    atomic_type: "unprocessed_input",
    label: "Could not fully process this input",
    source_text: params.sourcePreview ?? "",
    confidence: 0,
    confidence_tier: "quarantine",
    status: "quarantined",
    entities: [],
    attributes: { reason: params.reason },
    uncertainty: [
      createUncertainty("missing_text"),
      createUncertainty("unclear_source"),
    ],
    attached_fragments: [],
    merged_from_ids: [],
    updated_event_id: null,
    raw_input_id: params.rawInputId,
    candidate_id: null,
    timestamp: dual.timestamp,
    event_time: dual.event_time,
    ingestion_time: dual.ingestion_time,
    needs_review: true,
  };
}

export function createCorrectionEvent(params: {
  correctedEventId: string;
  previousValue: unknown;
  newValue: unknown;
  rawInputId: string;
  timestamp: string;
}): NormalizedAtomicEvent {
  const dual = withNormalizedDualTime(String(params.newValue), params.timestamp);
  return {
    id: createNormalizedEventId(),
    atomic_type: "correction",
    label: "User correction applied",
    source_text: String(params.newValue),
    confidence: 0.95,
    confidence_tier: "auto_commit",
    status: "committed",
    entities: [],
    attributes: {
      corrected_event_id: params.correctedEventId,
      previous_value: params.previousValue,
      new_value: params.newValue,
    },
    uncertainty: [],
    attached_fragments: [],
    merged_from_ids: [],
    updated_event_id: params.correctedEventId,
    raw_input_id: params.rawInputId,
    candidate_id: null,
    timestamp: dual.timestamp,
    event_time: dual.event_time,
    ingestion_time: dual.ingestion_time,
    needs_review: false,
  };
}

/**
 * EventNormalizer — mandatory step before graph commit.
 */
export function normalizeEvents(params: {
  caregiver_id: string;
  raw_input_id: string;
  content: string;
  input_type: string;
  candidates: ExtractionCandidate[];
  ocr_failed?: boolean;
  failure_reason?: string;
  timestamp?: string;
}): NormalizationResult {
  const caregiverId = params.caregiver_id;
  const timestamp = params.timestamp ?? new Date().toISOString();
  const actions: NormalizationAction[] = [];

  if (params.ocr_failed) {
    const unprocessed = createUnprocessedEvent({
      rawInputId: params.raw_input_id,
      reason: params.failure_reason ?? "ocr_failed",
      timestamp,
      sourcePreview: params.content.slice(0, 100),
    });
    return {
      committed: [],
      quarantined: [unprocessed],
      needs_review: [],
      unprocessed: [unprocessed],
      actions: [{ action: "quarantine", description: "OCR/extraction failed — input quarantined", event_ids: [unprocessed.id] }],
      clarification_question: "What is this about?",
      could_not_process: true,
    };
  }

  const pre = preNormalizeText(params.content, params.input_type);
  if (pre.fixes_applied.length > 0) {
    actions.push({
      action: "commit",
      description: `Pre-normalization applied: ${pre.fixes_applied.join(", ")}`,
      event_ids: [],
    });
  }

  let atomic = candidatesToAtomic(params.candidates, pre.normalized, params.raw_input_id, timestamp);

  if (hasMultipleActions(pre.normalized) && atomic.length > 1) {
    actions.push({
      action: "split",
      description: `Split composite input into ${atomic.length} atomic events`,
      event_ids: atomic.map((e) => e.id),
    });
  }

  const existing = getCommittedEvents(caregiverId);
  const { toCommit: afterMed, updated } = applyMedicationUpdateRule(atomic, existing);
  atomic = afterMed;
  for (const u of updated) {
    actions.push({ action: "update", description: u.description, event_ids: [u.event.id] });
    storeCommittedEvents(caregiverId, [u.event]);
  }

  const { toCommit, merged } = deduplicateEvents(atomic, existing);
  for (const m of merged) {
    actions.push({ action: "merge", description: m.description, event_ids: [m.kept.id, m.mergedId] });
    storeCommittedEvents(caregiverId, [m.kept]);
  }

  const committed: NormalizedAtomicEvent[] = [];
  const needs_review: NormalizedAtomicEvent[] = [];
  const quarantined: NormalizedAtomicEvent[] = [];

  for (const event of toCommit) {
    if (event.confidence_tier === "auto_commit") {
      committed.push({ ...event, status: "committed" });
    } else if (event.confidence_tier === "needs_review") {
      const reviewed = { ...event, status: "needs_review" as const, needs_review: true };
      needs_review.push(reviewed);
      committed.push(reviewed);
      actions.push({
        action: "commit",
        description: `Committed with needs_review: ${event.atomic_type}`,
        event_ids: [event.id],
      });
    } else {
      quarantined.push({ ...event, status: "needs_user_confirmation" });
      actions.push({
        action: "quarantine",
        description: `Quarantined low-confidence event: ${event.label.slice(0, 50)}`,
        event_ids: [event.id],
      });
    }
  }

  const allCommitted = [...getCommittedEvents(caregiverId), ...committed, ...needs_review];
  storeCommittedEvents(caregiverId, allCommitted);

  const clarification =
    quarantined.length > 0
      ? "What is this about?"
      : needs_review.length > 0
        ? "Can you confirm the details of the events marked for review?"
        : null;

  return {
    committed,
    quarantined,
    needs_review,
    unprocessed: [],
    actions,
    clarification_question: clarification,
    could_not_process: false,
  };
}
