import { recordCareEvent } from "../care-events/record-care-event";
import { ingestRawInput, validatedToCanonical } from "../data-acquisition-resilience";
import type { DareIngestResult } from "../data-acquisition-resilience/types";
import { appendEventsToContext, getCareContextRoot, getOrCreateCareContextRoot } from "./context-store";
import {
  buildProvisionalEvent,
  buildUnparsedRawEvent,
  filterByStatus,
} from "../care-event-integrity";
import { buildSituationUnderstanding } from "./parse-situation";
import {
  caregiverLineFromDareUncertain,
  caregiverLineFromUnreadableSection,
  sanitizeCaregiverFacingLines,
  sanitizeSituationUncertaintyFields,
} from "./caregiver-facing-uncertainty";
import { toCaregiverFacingLine } from "../mvp-input-architecture";
import { getTemporalTimeline, getIngestionTimeline, getTimelineViews } from "./dual-time";
import type { CanonicalCareEvent, ProcessSituationInput, SituationResponse } from "./types";
import {
  resolveDurableCareKey,
  detectContinuity,
  createCareIdentity,
  getCareIdentity,
  getCareIdentitySummary,
  incrementSessionCount,
  recordCareEvent as recordIdentityCareEvent,
  resolveActiveCareRecipientId as resolveIdentityActiveRecipient,
} from "../care-identity";
import {
  resolveClinicalProfileFromCareContext,
} from "../clinical-profile";
import { getOrCreateProfile } from "../cognitive-relief";
import {
  upsertTrackedSituationFromCareInput,
  trackedSituationToUiSituation,
} from "../resolution-engine/care-context-sync";
import { toActiveSituation } from "../ui-runtime/situation-store";
import { ingestActiveCareObservation } from "../active-care-situation";
import {
  ingestCareThread,
  looksLikeCareThread,
} from "../thread-ingestion";
import {
  groupEventsBySituationId,
  planSituationSpineLink,
  stampSituationSpineLink,
} from "../active-care-situation/spine-link";
import { classifyCareEventKind } from "../living-care-record-ux/event-clarifiers";
import { resolveCaregiverWords } from "../mvp-input-architecture";
import { attachPriorityToEvents, getTopEvents, queryPriorityEvents } from "../care-event-priority";
import { estimateContextWindowSize, processMemoryLayers } from "../care-memory-layers";
import {
  applyFailureMarkersToEvents,
  processFailureResilience,
  tagEventsWithProcessingStatus,
} from "../failure-resilience";
import { processTrustProvenance } from "../trust-provenance";
import { processNetworkEffectMoat } from "../network-effect-moat";
import { processSuccessModel } from "../success-model";
import {
  enforceFinalOutputAtBoundary,
} from "../final-output-contract";
import { processMvpSurfaceArea } from "../mvp-surface-area";
import {
  classifyInputForLoop,
  processContinuousExecutionLoop,
  reprocessContinuousExecutionLoop,
} from "../continuous-execution-loop";
import { processBehaviorInterpretation } from "../behavior-interpretation-engine";
import { processContinuityDecay } from "../continuity-decay-engine";
import { processNorthStarExperience } from "../north-star-experience";
import { processClarificationEngine } from "../clarification-engine";
import { processMemoryStrategy } from "../memory-strategy-engine";
import { processTrustLayerEngine } from "../trust-layer-engine";
import { processCrisisModeInteraction } from "../crisis-mode-interaction-layer";
import {
  attachAttributionToEvents,
  ensureContributorCareReality,
  processMultiCaregiverContext,
  resolveCareRecipientId,
} from "../multi-caregiver-context-model";
import { processAuditTrail, recordAudit } from "../audit-trail-system";
import { processStateOfCareSummary } from "../state-of-care-summary-engine";
import { processCareContextDiff } from "../care-context-diff-engine";
import { processCareTimelineEngine } from "../care-timeline-engine";
import { mapCanonicalToTimelineEvent } from "../care-timeline-engine/event-mapper";
import { processTaskExtraction } from "../task-extraction-engine";
import { processCurrentStateView } from "../current-state-view-engine";
import { processAdoptionWedge } from "../adoption-wedge-engine";
import { processForbiddenBuildZone } from "../forbidden-build-zone";
import { processProductRealityModel } from "../product-reality-model";
import { processTimelineReconstruction } from "../timeline-reconstruction-engine";
import { processContradictionDetection } from "../contradiction-detection-engine";
import { detectCareStateChanges } from "../care-state-change-detector";
import {
  attachTransparencyToFinalOutput,
  processCareTransparency,
} from "../care-transparency-layer";
import {
  buildEntryBehaviorLayer,
  classifyEntryInput,
  isSessionReentryInput,
} from "../entry-behavior-protocol";
import {
  compileFromAdoptionWedge,
} from "../final-output-contract/entry-compile";
import type { FinalOutputContract } from "../final-output-contract/types";
import {
  applyPolicyToClarification,
  applyPolicyToDiff,
  applyPolicyToFinalOutput,
  buildPolicyEngineLayer,
  validateIngestionPolicy,
  validateOutputPolicy,
} from "../policy-engine";
import { validateFinalOutput } from "../final-output-contract/schema";
import { processBaselineIntelligence } from "../baseline-intelligence-engine";
import { processCareRealityProfile } from "../care-reality-profile-engine";
import { processMomentOfNeed } from "../moment-of-need-engine";
import {
  processRetentionEngine,
  recordSessionVisit,
} from "../retention-engine";
import {
  enforceCompiledDominantOutput,
  processRuntimeArbitrationLayers,
} from "../priority-resolution-system";
import { processCareStateEngine } from "../care-state-engine";
import {
  nextInteractionIndex,
  processSingleUserJourney,
} from "../single-user-journey";
import {
  applySearchDemandContinuityRedirect,
  processProductNorthStar,
} from "../product-north-star";
import { processProductConstitution } from "../product-constitution";
import { processContinuityProperties } from "../continuity-properties";
import { processCareRealityIntelligence } from "../care-reality-intelligence";
import { processCareRealityEngineFoundation } from "../care-reality-engine";
import { processCareSignalUnderstanding } from "../care-signal-understanding";
import { processGeneralizedCareUnderstanding } from "../generalized-care-understanding";

function persistCanonicalEvent(
  event: CanonicalCareEvent,
  caregiverId: string,
  captureProvenance?: import("../care-events/types").InputProvenance | null,
): void {
  const inputType =
    captureProvenance?.input_type ??
    (event.source === "document" ? "document" : "text");

  void recordCareEvent({
    content: event.raw_input,
    created_by: caregiverId,
    provenance: {
      input_type: inputType,
      entry_method: captureProvenance?.entry_method,
      captured_at: captureProvenance?.captured_at ?? event.ingestion_time,
      recognition_confidence: captureProvenance?.recognition_confidence ?? null,
      transcript_uncertain: captureProvenance?.transcript_uncertain ?? false,
    },
    metadata: {
      canonical_care_event: event,
      dare_validated: true,
      extracted_type: event.extracted_type,
      entities: event.entities,
      attributes: event.attributes,
      uncertainty: event.uncertainty,
      source: event.source,
      root_event_id: event.root_event_id,
      document_id: event.document_id,
      ...(captureProvenance?.entry_method
        ? { entry_method: captureProvenance.entry_method }
        : {}),
    },
  });
}

function mergeDareResults(results: DareIngestResult[]): DareIngestResult {
  if (results.length === 0) {
    throw new Error("No DARE ingest results");
  }
  const first = results[0]!;
  return {
    raw_input: first.raw_input,
    candidates: results.flatMap((r) => r.candidates),
    uncertain_events: results.flatMap((r) => r.uncertain_events),
    unreadable_sections: results.flatMap((r) => r.unreadable_sections),
    disambiguation_questions: results.flatMap((r) => r.disambiguation_questions),
    conflicts: results.flatMap((r) => r.conflicts),
    validated_events: results.flatMap((r) => r.validated_events),
    provisional_count: results.reduce((n, r) => n + r.provisional_count, 0),
    normalization: results[results.length - 1]?.normalization ?? null,
  };
}

/**
 * Single entry pipeline — noisy input → DARE → validated CareEvents → CareContextRoot.
 * Graph is built from resolved truth only.
 */
export async function processSituationInput(
  input: ProcessSituationInput,
): Promise<SituationResponse> {
  const contributorId = resolveDurableCareKey({
    caregiver_id: input.contributor_id ?? input.caregiver_id,
    care_session_id: input.care_session_id,
  });
  // Locked B: Care Reality keyed by care recipient; contributor is attribution.
  ensureContributorCareReality(contributorId, input.care_recipient_id);
  const caregiverId = contributorId;

  // Phase 10 — Care Identity: ensure identity record exists, detect continuity type.
  // This runs before pipeline processing so the entire stack benefits from continuity awareness.
  const careRecipientIdForIdentity = input.care_recipient_id ?? caregiverId;
  let existingIdentity = getCareIdentity(careRecipientIdForIdentity);
  if (!existingIdentity) {
    existingIdentity = createCareIdentity({
      caregiverId,
      careRecipientId: careRecipientIdForIdentity,
    });
  }
  const identitySummary = getCareIdentitySummary(careRecipientIdForIdentity);
  const continuityDecision = detectContinuity({
    caregiverId,
    careRecipientId: careRecipientIdForIdentity,
    rawText: input.raw_input ?? "",
  });

  const hasDocuments = (input.documents?.length ?? 0) > 0;
  if (
    isSessionReentryInput({
      raw_input: input.raw_input?.trim() ?? "",
      has_documents: hasDocuments,
    })
  ) {
    return processSessionReentry({
      caregiver_id: caregiverId,
      raw_input: input.raw_input?.trim() ?? "",
      timestamp: input.timestamp,
    });
  }

  const priorContext = getCareContextRoot(caregiverId) ?? null;
  const isFirstSituation = !priorContext || priorContext.events.length === 0;

  const ingestionPolicy = validateIngestionPolicy({
    user_id: caregiverId,
    raw_input: input.raw_input,
    has_documents: hasDocuments,
  });

  // Capture always — consent soft-prompts after persist; never block CareEvent creation.
  void ingestionPolicy.allowed;

  getOrCreateCareContextRoot(caregiverId);
  const rootEventId = priorContext?.root_event_id ?? priorContext?.events[0]?.id ?? null;

  const dareResults: DareIngestResult[] = [];

  if (input.raw_input.trim()) {
    dareResults.push(
      ingestRawInput({
        caregiver_id: caregiverId,
        content: input.raw_input,
        input_type: "text",
        captured_at: input.timestamp,
      }),
    );
  }

  let documentEventsCount = 0;
  for (const doc of input.documents ?? []) {
    if (!doc.extracted_text?.trim()) continue;
    const { recordDocumentSourceEvidence } = await import("../document-evidence");
    await recordDocumentSourceEvidence({
      careKey: caregiverId,
      documentId: doc.id,
      originalName: doc.name,
      mimeType: doc.mime_type ?? null,
      extractedText: doc.extracted_text,
      capturedAt: input.timestamp,
    });
    dareResults.push(
      ingestRawInput({
        caregiver_id: caregiverId,
        content: doc.extracted_text,
        input_type: "pdf",
        document_id: doc.id,
        document_name: doc.name,
        ocr_confidence: doc.ocr_confidence ?? null,
        captured_at: input.timestamp,
      }),
    );
    documentEventsCount += 1;
  }

  const dare = dareResults.length > 0 ? mergeDareResults(dareResults) : null;

  const events: CanonicalCareEvent[] = [];
  if (dare) {
    for (const ve of dare.validated_events) {
      const canonical = validatedToCanonical(ve);
      // Session root fallback only; situation spine stamps overwrite before append.
      canonical.root_event_id = isFirstSituation && events.length === 0 ? null : rootEventId;
      canonical.situation_id = null;
      canonical.document_id = ve.document_id;
      events.push(canonical);
    }

    for (const result of dareResults) {
      if (
        result.unreadable_sections.length > 0 ||
        (result.normalization?.could_not_process && result.validated_events.length === 0)
      ) {
        const unparsed = buildUnparsedRawEvent({
          rawInput: result.raw_input,
          reason:
            result.unreadable_sections[0]?.reason ??
            result.normalization?.clarification_question ??
            "extraction_failed",
          caregiverId,
        });
        unparsed.root_event_id = isFirstSituation && events.length === 0 ? null : rootEventId;
        unparsed.situation_id = null;
        events.push(unparsed);
      }

      for (const uncertain of result.uncertain_events) {
        const provisional = buildProvisionalEvent({
          uncertain,
          rawInput: result.raw_input,
          caregiverId,
        });
        provisional.root_event_id = isFirstSituation && events.length === 0 ? null : rootEventId;
        provisional.situation_id = null;
        events.push(provisional);
      }
    }
  }

  // Capture always succeeds: free-text care input becomes at least one CareEvent.
  if (input.raw_input.trim() && events.length === 0) {
    const rawFromDare = dare?.raw_input;
    const fallbackRaw =
      rawFromDare ??
      ({
        id: `raw_fallback_${Date.now()}`,
        caregiver_id: caregiverId,
        input_type: "text" as const,
        content: input.raw_input.trim(),
        ocr_confidence: null,
        document_id: null,
        document_name: null,
        captured_at: input.timestamp ?? new Date().toISOString(),
        metadata: {},
      });
    const unparsed = buildUnparsedRawEvent({
      rawInput: fallbackRaw,
      reason: "free_text_observation",
      caregiverId,
    });
    unparsed.root_event_id = isFirstSituation ? null : rootEventId;
    unparsed.situation_id = null;
    events.push(unparsed);
  }

  if (input.raw_input.trim() && events.length > 0) {
    const sourceSnippet = input.raw_input.trim().slice(0, 500);
    for (const event of events) {
      event.attributes = { ...event.attributes, source_situation_text: sourceSnippet };
    }
  }

  // Classify relation on the server; soft updates share situation_id + root_event_id.
  let spineLink: ReturnType<typeof planSituationSpineLink> | null = null;
  if (events.length > 0) {
    const spineText =
      resolveCaregiverWords(events, input.raw_input) ?? input.raw_input.trim();
    const hasDocInput = (input.documents?.length ?? 0) > 0;
    const spineKind = classifyCareEventKind(
      spineText || input.raw_input,
      events[0]?.extracted_type,
      hasDocInput && !input.raw_input.trim(),
    );
    spineLink = planSituationSpineLink({
      caregiverId,
      rawText: spineText || input.raw_input.trim(),
      kind: spineKind,
      nowIso: input.timestamp ?? new Date().toISOString(),
      primaryEventId: events[0]!.id,
    });
    stampSituationSpineLink(events, spineLink);
    for (const event of events) {
      persistCanonicalEvent(event, caregiverId, input.provenance);
    }
  }

  const provisionalFromDare = dare
    ? [
        ...dare.uncertain_events
          .map((u) => caregiverLineFromDareUncertain(u))
          .filter((line): line is string => Boolean(line)),
        ...dare.unreadable_sections.map((s) =>
          caregiverLineFromUnreadableSection(s.reason),
        ),
        ...dare.disambiguation_questions
          .map((q) => toCaregiverFacingLine(q.question))
          .filter((line): line is string => Boolean(line)),
      ]
    : [];

  const priorCount = priorContext?.events.length ?? 0;
  const careRecipientId = resolveCareRecipientId(caregiverId);
  const attributedEvents = attachAttributionToEvents(events, caregiverId, careRecipientId);
  const context = appendEventsToContext(caregiverId, attributedEvents);
  const events_created = context.events.slice(priorCount);
  const priorityQuery = queryPriorityEvents(context.events);

  const unifiedInputType = classifyInputForLoop({
    raw_input: input.raw_input,
    documents: input.documents,
  });

  const continuous_execution_loop_layer = processContinuousExecutionLoop({
    caregiver_id: caregiverId,
    raw_input: input.raw_input,
    input_type: unifiedInputType,
    prior_context: priorContext,
    context,
    events_created,
    dare,
    is_first_situation: isFirstSituation,
    document_ids: input.documents?.map((d) => d.id),
    captured_at: input.timestamp,
  });

  const whatChanged = continuous_execution_loop_layer.what_changed;

  const { understood, uncertain, clarification, tracked } = buildSituationUnderstanding(events_created);
  const mergedUncertain = sanitizeCaregiverFacingLines([
    ...uncertain,
    ...provisionalFromDare,
    ...continuous_execution_loop_layer.open_uncertainties,
  ]);

  const clarificationRaw = processClarificationEngine({
    caregiver_id: caregiverId,
    raw_input: input.raw_input,
    events_created,
    what_is_uncertain: mergedUncertain,
    dare_disambiguation: dare?.disambiguation_questions.map((q) => q.question),
  });
  const clarificationPolicy = applyPolicyToClarification(caregiverId, clarificationRaw);
  const clarification_engine_layer = clarificationPolicy.layer;

  const mergedClarification = sanitizeCaregiverFacingLines([
    ...clarification_engine_layer.questions.map((q) => q.question),
    ...clarification,
    ...(dare?.disambiguation_questions.map((q) => q.question) ?? []),
    ...(dare?.normalization?.clarification_question ? [dare.normalization.clarification_question] : []),
  ], Math.max(clarification_engine_layer.budget_max, 5), { asksOnly: true });

  const memory = processMemoryLayers({
    caregiver_id: caregiverId,
    events: context.events,
    current_situation: input.raw_input.trim() || undefined,
    unresolved_questions: mergedClarification,
  });

  const memory_strategy_layer = processMemoryStrategy({
    caregiver_id: caregiverId,
    events_created: events_created,
    all_events: context.events,
    as_of: input.timestamp ?? new Date().toISOString(),
  });

  const failureResilience = processFailureResilience({
    caregiver_id: caregiverId,
    dare,
    events_created,
    prior_events: priorContext?.events ?? [],
    raw_input: input.raw_input,
  });

  const markedEvents = applyFailureMarkersToEvents(
    tagEventsWithProcessingStatus(events_created, failureResilience.processing_status),
    failureResilience.failures,
  );

  if (markedEvents.some((e, i) => e !== events_created[i])) {
    for (let i = 0; i < markedEvents.length; i++) {
      const marked = markedEvents[i]!;
      const idx = context.events.findIndex((e) => e.id === marked.id);
      if (idx >= 0) context.events[idx] = marked;
    }
  }

  const trustProvenance = processTrustProvenance({
    caregiver_id: caregiverId,
    events_created: markedEvents,
    context_events: context.events,
    dare,
    unresolved_questions: mergedClarification,
    what_changed: whatChanged,
    capture_provenance: input.provenance ?? null,
  });

  const networkEffectMoat = processNetworkEffectMoat({
    caregiver_id: caregiverId,
    new_events: markedEvents,
    prior_events: priorContext?.events ?? [],
    all_events: context.events,
    unresolved_questions: mergedClarification,
    what_changed: whatChanged,
    dare,
    prior_link_count: memory.store.structured.links.length,
  });

  const successModel = processSuccessModel({
    caregiver_id: caregiverId,
    events: context.events,
    events_created: markedEvents,
    what_changed: whatChanged,
    unresolved_questions: mergedClarification,
    dare,
    failure: failureResilience,
    trust: trustProvenance,
    moat: networkEffectMoat,
    top_event_ids: priorityQuery.top_events.map((e) => e.id),
    attention_event_ids: priorityQuery.attention_events.map((e) => e.id),
    context_window_chars: estimateContextWindowSize(memory.context_window),
    has_active_episode: memory.store.active_episode_id !== null,
  });

  const behavior_interpretation_layer = processBehaviorInterpretation({
    caregiver_id: caregiverId,
    events_created: markedEvents,
    all_events: context.events,
    prior_events: priorContext?.events ?? [],
    what_changed: whatChanged,
    situation_snippets: input.raw_input.trim() ? [input.raw_input.trim()] : [],
  });

  const baseline_intelligence_layer = processBaselineIntelligence({
    caregiver_id: caregiverId,
    care_recipient_id: context.care_recipient_id,
    events_created: markedEvents,
    all_events: context.events,
    raw_input: input.raw_input,
    as_of: input.timestamp ?? new Date().toISOString(),
  });

  const continuity_decay_layer = processContinuityDecay({
    caregiver_id: caregiverId,
    all_events: context.events,
    events_created: markedEvents,
    what_needs_clarification: mergedClarification,
    what_is_uncertain: mergedUncertain,
    attention_event_ids: priorityQuery.attention_events.map((e) => e.id),
    what_changed: whatChanged,
    as_of: input.timestamp ?? new Date().toISOString(),
    trigger: "entry",
  });

  const north_star_experience_layer = processNorthStarExperience({
    caregiver_id: caregiverId,
    raw_input: input.raw_input,
    is_first_situation: isFirstSituation,
    events_created: markedEvents,
    all_events: context.events,
    prior_event_count: priorContext?.events.length ?? 0,
    what_changed: whatChanged,
    what_i_understood: understood,
    what_is_uncertain: mergedUncertain,
    what_needs_clarification: mergedClarification,
    has_decision_trace: true,
    has_confidence_surface: trustProvenance.confidence_assessment.level !== undefined,
    as_of: input.timestamp ?? new Date().toISOString(),
  });

  const trust_layer_engine_layer = processTrustLayerEngine({
    caregiver_id: caregiverId,
    events_created: markedEvents,
    all_events: context.events,
    what_is_uncertain: mergedUncertain,
    what_needs_clarification: mergedClarification,
    trust_provenance: trustProvenance,
    behavior: behavior_interpretation_layer,
    continuity_decay: continuity_decay_layer,
    memory_strategy: memory_strategy_layer,
    clarification: clarification_engine_layer,
    attention_event_ids: priorityQuery.attention_events.map((e) => e.id),
    as_of: input.timestamp ?? new Date().toISOString(),
  });

  const crisis_mode_interaction_layer = processCrisisModeInteraction({
    caregiver_id: caregiverId,
    raw_input: input.raw_input,
    events_created: markedEvents,
    all_events: context.events,
    behavior: behavior_interpretation_layer,
    attention_event_ids: priorityQuery.attention_events.map((e) => e.id),
    what_changed: whatChanged,
    as_of: input.timestamp ?? new Date().toISOString(),
  });

  const multi_caregiver_context_layer = processMultiCaregiverContext({
    caregiver_id: caregiverId,
    care_recipient_id: context.care_recipient_id,
    events_created: markedEvents,
    all_events: context.events,
    what_changed: whatChanged,
    as_of: input.timestamp ?? new Date().toISOString(),
  });

  for (const conflict of multi_caregiver_context_layer.conflict_log.slice(-3)) {
    recordAudit({
      actor: { type: "system", id: "fusion_engine" },
      action_type: "merge",
      entity_type: "care_context_conflict",
      entity_id: conflict.conflict_id,
      previous_state: null,
      new_state: {
        contradiction_type: conflict.contradiction_type,
        shared_abstract: conflict.shared_abstract_message,
      },
      reason: "contradiction_resolution",
      reason_detail: conflict.description,
      confidence_after: 0.45,
      related_events: conflict.event_ids,
      conflict_relationship: "contradiction",
      care_recipient_id: context.care_recipient_id,
      timestamp: input.timestamp ?? new Date().toISOString(),
    });
  }

  const audit_trail_layer = processAuditTrail({
    care_recipient_id: context.care_recipient_id,
    events_created_count: markedEvents.length,
  });

  const state_of_care_summary_layer = processStateOfCareSummary({
    caregiver_id: caregiverId,
    context,
    events_created: markedEvents,
    what_changed: whatChanged,
    what_is_uncertain: mergedUncertain,
    what_needs_clarification: [
      ...new Set([
        ...mergedClarification,
        ...multi_caregiver_context_layer.clarification_needed,
      ]),
    ],
    behavior: behavior_interpretation_layer,
    continuity_decay: continuity_decay_layer,
    trust_layer: trust_layer_engine_layer,
    multi_caregiver: multi_caregiver_context_layer,
    crisis_mode: crisis_mode_interaction_layer,
    attention_event_ids: priorityQuery.attention_events.map((e) => e.id),
    as_of: input.timestamp ?? new Date().toISOString(),
  });

  const careContextDiffRaw = processCareContextDiff({
    caregiver_id: caregiverId,
    prior_context: priorContext,
    context,
    events_created: markedEvents,
    state_diff: continuous_execution_loop_layer.diff,
    what_changed: whatChanged,
    behavior: behavior_interpretation_layer,
    continuity_decay: continuity_decay_layer,
    multi_caregiver: multi_caregiver_context_layer,
    state_of_care: state_of_care_summary_layer.summary,
    attention_event_ids: priorityQuery.attention_events.map((e) => e.id),
    as_of: input.timestamp ?? new Date().toISOString(),
  });
  const diffPolicy = applyPolicyToDiff(caregiverId, careContextDiffRaw.diff);
  const care_context_diff_layer = {
    ...careContextDiffRaw,
    diff: diffPolicy.sanitized_diff ?? careContextDiffRaw.diff,
  };

  const care_reality_profile_layer = processCareRealityProfile({
    care_recipient_id: context.care_recipient_id,
    all_events: context.events,
    baseline: baseline_intelligence_layer,
    behavior: behavior_interpretation_layer,
    memory_strategy: memory_strategy_layer,
    what_is_uncertain: mergedUncertain,
    what_needs_clarification: [
      ...new Set([
        ...mergedClarification,
        ...multi_caregiver_context_layer.clarification_needed,
      ]),
    ],
    as_of: input.timestamp ?? new Date().toISOString(),
  });

  const moment_of_need_layer = processMomentOfNeed({
    raw_input: input.raw_input,
    events_created: markedEvents,
    all_events: context.events,
    baseline: baseline_intelligence_layer,
    care_reality_profile: care_reality_profile_layer,
    care_context_diff: care_context_diff_layer,
    behavior: behavior_interpretation_layer,
    what_is_uncertain: mergedUncertain,
    as_of: input.timestamp ?? new Date().toISOString(),
  });

  const care_timeline_engine_layer = processCareTimelineEngine({
    caregiver_id: caregiverId,
    care_recipient_id: context.care_recipient_id,
    events: context.events,
    events_created: markedEvents,
    multi_caregiver: multi_caregiver_context_layer,
    as_of: input.timestamp ?? new Date().toISOString(),
  });

  const timeline_reconstruction_layer = processTimelineReconstruction({
    caregiver_id: caregiverId,
    raw_input: input.raw_input,
    events: context.events,
    events_created: markedEvents,
    as_of: input.timestamp ?? new Date().toISOString(),
  });

  const contradiction_detection_layer = processContradictionDetection({
    caregiver_id: caregiverId,
    care_recipient_id: context.care_recipient_id,
    events: context.events,
    events_created: markedEvents,
    care_timeline: care_timeline_engine_layer,
    as_of: input.timestamp ?? new Date().toISOString(),
  });

  const care_state_change_report = detectCareStateChanges({
    priorContext: priorContext,
    currentContext: context,
    eventsCreated: markedEvents,
    baselineFacts: baseline_intelligence_layer.baseline_facts,
    baselineDeviations: baseline_intelligence_layer.deviations,
    contradictions: {
      open_contradictions: contradiction_detection_layer.open_contradictions.map((c) => ({
        field: c.field,
        event_ids: c.event_ids,
        shared_message: c.shared_message,
        affects_safety: c.affects_safety,
      })),
      change_classifications: [],
    },
  });

  const createdTimelineEvents = markedEvents
    .map(mapCanonicalToTimelineEvent)
    .filter((e): e is NonNullable<typeof e> => e !== null);

  const task_extraction_layer = processTaskExtraction({
    caregiver_id: caregiverId,
    care_recipient_id: context.care_recipient_id,
    timeline_events: care_timeline_engine_layer.care_truth.timeline,
    events_created: createdTimelineEvents,
  });

  const current_state_view_layer = processCurrentStateView({
    care_recipient_id: context.care_recipient_id,
    care_record: care_timeline_engine_layer.care_record,
    care_truth: care_timeline_engine_layer.care_truth,
    tasks: task_extraction_layer.tasks,
    what_matters_most: state_of_care_summary_layer.summary.what_matters_most,
    as_of: input.timestamp ?? new Date().toISOString(),
  });

  const adoption_wedge_layer = processAdoptionWedge({
    caregiver_id: caregiverId,
    is_first_situation: isFirstSituation,
    events_created_count: markedEvents.length,
    care_timeline: care_timeline_engine_layer,
    current_state: current_state_view_layer,
    tasks: task_extraction_layer,
    entry_mode: undefined,
  });

  const product_reality_model_layer = processProductRealityModel({
    has_contradictions:
      care_timeline_engine_layer.conflicts_detected > 0 ||
      contradiction_detection_layer.open_contradictions.length > 0,
    contradiction_count:
      care_timeline_engine_layer.conflicts_detected +
      contradiction_detection_layer.open_contradictions.length,
    has_uncertainty: mergedUncertain.length > 0,
    uncertainty_count: mergedUncertain.length,
    events_appended: markedEvents.length,
    state_derived: true,
    manual_state_edit: false,
  });

  const care_state_engine_layer = processCareStateEngine({
    care_recipient_id: context.care_recipient_id,
    all_events: context.events,
    events_created: markedEvents,
    what_is_uncertain: mergedUncertain,
    what_needs_clarification: [
      ...new Set([
        ...mergedClarification,
        ...multi_caregiver_context_layer.clarification_needed,
        ...contradiction_detection_layer.clarification_triggers,
        ...timeline_reconstruction_layer.clarification_triggers,
      ]),
    ],
    care_context_diff: care_context_diff_layer,
    state_of_care: state_of_care_summary_layer,
    as_of: input.timestamp ?? new Date().toISOString(),
  });

  const whatMergedOrSplit =
    dare?.normalization?.actions.map((a) => a.description) ?? [];

  if (dare?.normalization?.could_not_process) {
    whatMergedOrSplit.unshift("Could not fully process this input");
  }

  const timeline_views = getTimelineViews(context.events);

  const integrity_summary = {
    provisional_in_graph: filterByStatus(context.events, ["provisional"]).length,
    unparsed_in_graph: filterByStatus(context.events, ["unparsed_raw"]).length,
    invalidated: filterByStatus(context.events, ["invalidated"]).length,
    superseded: filterByStatus(context.events, ["superseded"]).length,
  };

  const situationResponse = {
    what_i_understood: understood,
    what_is_uncertain: mergedUncertain,
    what_needs_clarification: [
      ...new Set([
        ...mergedClarification,
        ...multi_caregiver_context_layer.clarification_needed,
        ...contradiction_detection_layer.clarification_triggers,
        ...timeline_reconstruction_layer.clarification_triggers,
      ]),
    ],
    what_will_be_tracked: tracked,
    what_changed: whatChanged,
    what_merged_or_split: whatMergedOrSplit,
    events_created: markedEvents,
    context,
    is_first_situation: isFirstSituation,
    document_events_count: documentEventsCount,
    dare: dare
      ? {
          provisional_count: dare.provisional_count,
          uncertain_events: dare.uncertain_events,
          unreadable_sections: dare.unreadable_sections,
          disambiguation_questions: dare.disambiguation_questions,
          conflicts: dare.conflicts,
          candidates_count: dare.candidates.length,
          validated_count: dare.validated_events.length,
          normalization_actions: dare.normalization?.actions ?? [],
          could_not_process: dare.normalization?.could_not_process ?? false,
        }
      : null,
    timeline_views,
    integrity_summary,
    priority_layer: {
      top_events: priorityQuery.top_events.map((e) => e.id),
      attention_events: priorityQuery.attention_events.map((e) => e.id),
      hidden_count: priorityQuery.hidden_count,
    },
    memory_layer: {
      active_episode_id: memory.store.active_episode_id,
      episode_count: memory.store.episodes.length,
      long_term_summary_count: memory.store.long_term_summaries.length,
      total_raw_events: memory.store.raw_event_refs.length,
      retrieval_order: [...memory.retrieval.retrieval_order],
      context_window_chars: estimateContextWindowSize(memory.context_window),
    },
    failure_resilience_layer: {
      failures: failureResilience.failures,
      confidence_summaries: failureResilience.confidence_summaries,
      pending_processing: failureResilience.pending_processing,
      outcomes_applied: failureResilience.outcomes_applied,
      processing_status: failureResilience.processing_status,
      recovery_actions: failureResilience.recovery_actions,
      continuity_preserved: failureResilience.continuity_preserved,
    },
    trust_provenance_layer: {
      provenance_records: trustProvenance.provenance_records,
      trust_indicators: trustProvenance.trust_indicators,
      audit_trail_summary: trustProvenance.audit_trail_summary,
      evidence_bundles: trustProvenance.evidence_bundles,
      reasoning_chains: trustProvenance.reasoning_chains,
      confidence_assessment: trustProvenance.confidence_assessment,
      retrieval_context: trustProvenance.retrieval_context,
      generation_boundaries: trustProvenance.generation_boundaries,
      insufficient_evidence_message: trustProvenance.insufficient_evidence_message,
    },
    network_effect_moat_layer: {
      interaction_outcomes: networkEffectMoat.interaction_outcomes,
      enrichment_actions: networkEffectMoat.enrichment_actions,
      entity_matches: networkEffectMoat.entity_matches,
      event_matches: networkEffectMoat.event_matches,
      resolved_uncertainties: networkEffectMoat.resolved_uncertainties,
      new_relationships: networkEffectMoat.new_relationships,
      compounding_metrics: networkEffectMoat.compounding_metrics,
      moat_strength: networkEffectMoat.moat_strength,
      maturity_stage: networkEffectMoat.maturity_stage,
      maturity_message: networkEffectMoat.maturity_message,
      context_grew: networkEffectMoat.context_grew,
      isolated_records: networkEffectMoat.isolated_records,
    },
    success_model_layer: {
      primary: successModel.primary,
      system_quality: successModel.system_quality,
      user_trust: successModel.user_trust,
      longitudinal: successModel.longitudinal,
      overall_success_score: successModel.overall_success_score,
      overall_level: successModel.overall_level,
      outcome_summary: successModel.outcome_summary,
      recall_probes: successModel.recall_probes,
      activity_metrics_excluded: successModel.activity_metrics_excluded,
    },
    continuous_execution_loop_layer,
    behavior_interpretation_layer,
    baseline_intelligence_layer,
    continuity_decay_layer,
    north_star_experience_layer,
    clarification_engine_layer,
    memory_strategy_layer,
    trust_layer_engine_layer,
    crisis_mode_interaction_layer,
    multi_caregiver_context_layer,
    audit_trail_layer,
    state_of_care_summary_layer,
    care_context_diff_layer,
    care_reality_profile_layer,
    moment_of_need_layer,
    care_timeline_engine_layer,
    timeline_reconstruction_layer,
    contradiction_detection_layer,
    task_extraction_layer,
    current_state_view_layer,
    adoption_wedge_layer,
    product_reality_model_layer,
    care_state_engine_layer,
    policy_engine_layer: {
      ...buildPolicyEngineLayer(caregiverId),
      ingestion: ingestionPolicy,
    },
    care_state_change_report,
  };

  const arbitration = processRuntimeArbitrationLayers({
    caregiver_id: caregiverId,
    response: situationResponse,
    is_session_reentry: false,
    is_return_session: false,
    as_of: input.timestamp ?? new Date().toISOString(),
  });

  const withArbitration = { ...situationResponse, ...arbitration };

  const mvp_surface_area_layer = processMvpSurfaceArea({
    caregiver_id: caregiverId,
    response: withArbitration,
    is_return_session: !isFirstSituation,
  });

  const withMvpLayer = { ...withArbitration, mvp_surface_area_layer };

  const { final_output, architectural_boundaries_layer } = enforceCompiledDominantOutput(
    withMvpLayer,
    arbitration.priority_resolution_layer,
    arbitration.edge_state_layer,
  );

  const finalized = finalizeSituationResponse(withMvpLayer, final_output, architectural_boundaries_layer);
  recordSessionVisit({
    caregiver_id: caregiverId,
    care_recipient_id: finalized.context.care_recipient_id,
    event_count: finalized.context.events.length,
    context_updated_at: finalized.context.updated_at,
    visited_at: input.timestamp ?? finalized.context.updated_at,
  });

  const interaction_index = nextInteractionIndex(caregiverId);
  const single_user_journey_layer = processSingleUserJourney({
    caregiver_id: caregiverId,
    interaction_index,
    raw_input: input.raw_input,
    events_created_count: markedEvents.length,
    total_event_count: finalized.context.events.length,
    care_context_exists: finalized.context.events.length >= 0,
    has_state_of_care: finalized.state_of_care_summary_layer?.active === true,
    has_meaningful_diff: finalized.care_context_diff_layer?.has_meaningful_change === true,
    dominant_mode: finalized.priority_resolution_layer?.dominant_mode ?? "state_of_care_summary",
    final_what_is_happening: finalized.final_output.what_is_happening,
    what_changed: finalized.what_changed,
    is_session_reentry: false,
  });

  const product_north_star_layer = processProductNorthStar({
    raw_input: input.raw_input,
    final_what_is_happening: finalized.final_output.what_is_happening,
    final_what_matters_now: finalized.final_output.what_matters_now,
    final_what_can_wait: finalized.final_output.what_can_wait,
    what_changed: finalized.what_changed,
    has_care_events: finalized.context.events.length > 0,
    has_meaningful_diff: finalized.care_context_diff_layer?.has_meaningful_change === true,
    has_state_of_care: finalized.state_of_care_summary_layer?.active === true,
  });

  const recipientProfile = getOrCreateProfile({ caregiver_id: caregiverId });
  const clinicalProfileId = resolveClinicalProfileFromCareContext(
    recipientProfile.care_context,
  );

  const continuity_properties_layer = processContinuityProperties({
    caregiver_id: caregiverId,
    care_recipient_id: care_state_engine_layer.care_state.care_recipient_id,
    raw_input: input.raw_input,
    all_events: finalized.context.events,
    events_created: markedEvents,
    what_is_happening: finalized.final_output.what_is_happening,
    what_changed: finalized.what_changed,
    what_needs_clarification: finalized.what_needs_clarification ?? [],
    what_needs_attention: care_state_engine_layer.care_state.needs_attention,
    what_is_stable: care_state_engine_layer.care_state.what_is_stable,
    conflict_count:
      (finalized.contradiction_detection_layer?.open_contradictions.length ?? 0) +
      (finalized.care_timeline_engine_layer?.conflicts_detected ?? 0),
    has_meaningful_diff: finalized.care_context_diff_layer?.has_meaningful_change === true,
    clarification_question_count: finalized.clarification_engine_layer?.questions?.length ?? 0,
    presentation_mode: "standard",
    clinical_profile_id: clinicalProfileId,
  });

  const care_reality_intelligence_layer = processCareRealityIntelligence({
    care_recipient_id: care_state_engine_layer.care_state.care_recipient_id,
    all_events: finalized.context.events,
    events_created: markedEvents,
    what_changed: finalized.what_changed,
    what_is_happening: finalized.final_output.what_is_happening,
    what_needs_attention: care_state_engine_layer.care_state.needs_attention,
    what_is_uncertain: finalized.what_is_uncertain ?? [],
    baseline: finalized.baseline_intelligence_layer,
    care_reality_profile: finalized.care_reality_profile_layer,
    care_state: care_state_engine_layer.care_state,
    continuity_properties: continuity_properties_layer,
    moment_of_need: finalized.moment_of_need_layer,
    as_of: input.timestamp ?? new Date().toISOString(),
  });

  // Active Care Situation — server-side continuity keyed by durable care identity.
  // Spine already stamped situation_id / root_event_id on CareEvents before append.
  const acsSourceText =
    resolveCaregiverWords(markedEvents, input.raw_input) ?? input.raw_input.trim();
  const hasDocInput = (input.documents?.length ?? 0) > 0;
  const nowIso = input.timestamp ?? new Date().toISOString();

  // Locked B: detect/split on newline-preserving raw text — never sanitize-flattened display text.
  const docThreadText =
    input.documents
      ?.map((d) => d.extracted_text?.trim() ?? "")
      .find((t) => t.length > 0 && looksLikeCareThread(t)) ?? "";
  const rawThreadCandidate = [input.raw_input?.replace(/\r\n/g, "\n").trim() ?? "", docThreadText]
    .find((t) => t.length > 0 && looksLikeCareThread(t));

  const acsKind = classifyCareEventKind(
    rawThreadCandidate || acsSourceText || input.raw_input,
    markedEvents[0]?.extracted_type,
    hasDocInput && !input.raw_input.trim(),
  );
  const eventIds = markedEvents.map((e) => e.id);
  const situationId = spineLink?.situation_id ?? markedEvents[0]?.situation_id ?? undefined;
  const acsRootEventId =
    spineLink?.root_event_id ?? markedEvents[0]?.root_event_id ?? null;

  // G6 — long chat/email (paste or document extract) → multiple linked ACS observations.
  let acsTurn;
  if (rawThreadCandidate) {
    const threadResult = ingestCareThread({
      caregiverId,
      rawThread: rawThreadCandidate,
      nowIso,
      contributorId: caregiverId,
      eventIds,
      situationId,
      rootEventId: acsRootEventId,
    });
acsTurn =
      threadResult.turns[threadResult.turns.length - 1] ??
      ingestActiveCareObservation({
        caregiverId,
        rawText: rawThreadCandidate,
        kind: acsKind,
        eventIds,
        nowIso,
        situationId,
        rootEventId: acsRootEventId,
        contributorId: caregiverId,
        forceRelation: spineLink?.relation,
        relationshipDecision: spineLink?.relationship_decision,
        isReinforcement: spineLink?.is_reinforcement,
        identityMismatch: spineLink?.identity_mismatch,
        isImprovementOutcome: spineLink?.is_improvement_outcome,
        continuityDecision,
      });
  } else {
    acsTurn = ingestActiveCareObservation({
      caregiverId,
      rawText: acsSourceText || input.raw_input.trim(),
      kind: acsKind,
      eventIds,
      nowIso,
      situationId,
      rootEventId: acsRootEventId,
      contributorId: caregiverId,
      // Single-flight: ACS must not re-decide against the stamped spine relation.
      forceRelation: spineLink?.relation,
      relationshipDecision: spineLink?.relationship_decision,
      isReinforcement: spineLink?.is_reinforcement,
      identityMismatch: spineLink?.identity_mismatch,
      isImprovementOutcome: spineLink?.is_improvement_outcome,
      // Phase 10: Carries continuity decision so the composer can branch
      // behavior for new vs returning caregivers.
      continuityDecision,
    });
  }

  // Constitution CareRecord spine after ACS — person_profile uses caregiver display name.
  const product_constitution_layer = processProductConstitution({
    care_recipient_id: care_state_engine_layer.care_state.care_recipient_id,
    all_events: finalized.context.events,
    events_created: markedEvents,
    what_is_uncertain: finalized.what_is_uncertain ?? [],
    what_needs_clarification: finalized.what_needs_clarification ?? [],
    care_state: care_state_engine_layer.care_state,
    care_context_diff: finalized.care_context_diff_layer,
    state_of_care: finalized.state_of_care_summary_layer,
    subject_label: acsTurn.situation.subject_label ?? null,
    final_what_matters_now: finalized.final_output.what_matters_now,
    final_what_can_wait: finalized.final_output.what_can_wait,
    what_changed: finalized.what_changed,
    as_of: input.timestamp ?? new Date().toISOString(),
  });

  // TrackedSituation follows ACS relation — opens_new retires sticky prior ACTIVE titles.
  // Locked B: sidebar situations live on the Care Reality (care_recipient_id), not the contributor.
  const trackedCareRecipientId = finalized.context.care_recipient_id;
  const trackedSync = upsertTrackedSituationFromCareInput({
    durableCareKey: trackedCareRecipientId,
    rawInput: input.raw_input,
    eventIds: markedEvents.map((e) => e.id),
    documentIds: [
      ...markedEvents.map((e) => e.document_id).filter((id): id is string => Boolean(id)),
      ...(input.documents?.map((d) => d.id) ?? []),
    ],
    userId: caregiverId,
    opensNewSituation: acsTurn.relation === "opens_new",
  });

  const care_situation_groups = groupEventsBySituationId(finalized.context.events).map(
    ({ situation_id, root_event_id, event_ids }) => ({
      situation_id,
      root_event_id,
      event_ids,
    }),
  );

  // North Star: Search Demand never becomes FAQ/answer-engine output.
  const searchRedirect = applySearchDemandContinuityRedirect({
    final_output: finalized.final_output,
    demand: product_north_star_layer.demand,
    has_care_events: finalized.context.events.length > 0,
    what_changed: finalized.what_changed,
  });
  const product_north_star_enforced = {
    ...product_north_star_layer,
    refused_generic_search_answer: searchRedirect.refused_generic_search_answer,
  };

  // Care Reality Engine Foundation — all phases connected on the live path.
  const care_reality_engine_layer = processCareRealityEngineFoundation({
    care_recipient_id: care_state_engine_layer.care_state.care_recipient_id,
    contributor_id: caregiverId,
    raw_input: input.raw_input,
    document_texts: (input.documents ?? [])
      .map((d) => d.extracted_text?.trim() ?? "")
      .filter(Boolean),
    event_ids: markedEvents.map((e) => e.id),
    what_is_happening: searchRedirect.final_output.what_is_happening,
    what_changed: finalized.what_changed,
    what_matters_now: searchRedirect.final_output.what_matters_now,
    what_is_uncertain: finalized.what_is_uncertain ?? [],
    what_to_ask_next: searchRedirect.final_output.what_to_ask_next,
    what_can_wait: searchRedirect.final_output.what_can_wait,
    baseline_facts: finalized.baseline_intelligence_layer?.baseline_facts?.map((f) => ({
      domain: f.domain,
      label: f.label,
      source_event_ids: f.source_event_ids,
      confidence: f.confidence,
    })),
    baseline_deviations: finalized.baseline_intelligence_layer?.deviations?.map((d) => ({
      observation: d.observation,
      compared_to_baseline: d.compared_to_baseline,
      deviation_type: d.deviation_type,
      source_event_id: d.source_event_id,
    })),
    conflict_note:
      (finalized.contradiction_detection_layer?.open_contradictions?.length ?? 0) > 0
        ? "There is conflicting information — both records are kept."
        : null,
    final_output: searchRedirect.final_output,
    risk_level: searchRedirect.final_output.risk_level,
    as_of: input.timestamp ?? new Date().toISOString(),
  });

  let foundationOutput = searchRedirect.final_output;
  if (care_reality_engine_layer.safety?.output) {
    foundationOutput = care_reality_engine_layer.safety.output;
  }
  if (care_reality_engine_layer.capacity.overload_likely) {
    const ask = foundationOutput.what_to_ask_next;
    const asks = Array.isArray(ask) ? ask : ask ? [ask] : [];
    foundationOutput = {
      ...foundationOutput,
      what_to_ask_next: asks.slice(0, care_reality_engine_layer.capacity.max_asks)[0] ?? "",
      what_can_wait: care_reality_engine_layer.capacity.shorten_response
        ? foundationOutput.what_can_wait || "Other details can wait until the main concern is clearer."
        : foundationOutput.what_can_wait,
    };
  }

  // Care Signal Understanding — fragments of care reality, never a task list.
  const care_signal_understanding_layer = processCareSignalUnderstanding({
    raw_input: input.raw_input,
    contributor_id: caregiverId,
  });
  const generalized_care_understanding_layer = processGeneralizedCareUnderstanding({
    raw_input: input.raw_input,
    contributor_id: caregiverId,
    prior_held: (finalized.what_changed ?? [])
      .concat(
        (finalized.what_is_uncertain ?? []).map((u) =>
          typeof u === "string" ? u : String(u),
        ),
      )
      .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      .slice(0, 8),
  });
  // Enrich orientation when signal layer has clearer unknowns / priority (no jargon).
  // FinalOutputContract holds unknowns on decision_trace (not a top-level what_is_uncertain).
  {
    const existingUncertain = [
      ...(foundationOutput.decision_trace?.unknowns ?? []),
      ...(finalized.what_is_uncertain ?? []),
    ].filter((u): u is string => typeof u === "string" && u.trim().length > 0);
    const fromLoops = generalized_care_understanding_layer.open_loops.map((l) => l.question);
    const mergedUncertain = [
      ...new Set([
        ...existingUncertain,
        ...care_signal_understanding_layer.uncertain.slice(0, 3),
        ...fromLoops.slice(0, 2),
      ]),
    ].slice(0, 5);
    const askNext =
      generalized_care_understanding_layer.worth_following_up[0] ??
      care_signal_understanding_layer.what_would_improve_understanding[0] ??
      foundationOutput.what_to_ask_next;
    const matters =
      generalized_care_understanding_layer.requires_attention_now?.trim() ||
      care_signal_understanding_layer.what_matters_now?.trim() ||
      foundationOutput.what_matters_now;
    const happening =
      care_signal_understanding_layer.care_state_understanding?.trim() ||
      foundationOutput.what_is_happening;
    const canWait =
      foundationOutput.what_can_wait ||
      (generalized_care_understanding_layer.useful_background.length > 0
        ? "Background details that do not change what needs attention first."
        : foundationOutput.what_can_wait);
    const heldUnknownStatements = new Set(
      (foundationOutput.trust_layer?.unknown ?? []).map((u) => u.statement),
    );
    foundationOutput = {
      ...foundationOutput,
      what_is_happening: happening,
      what_matters_now: matters,
      what_to_ask_next: askNext,
      what_can_wait: canWait,
      decision_trace: {
        ...foundationOutput.decision_trace,
        unknowns: mergedUncertain,
      },
      trust_layer: {
        ...foundationOutput.trust_layer,
        unknown: [
          ...(foundationOutput.trust_layer?.unknown ?? []),
          ...mergedUncertain
            .filter((statement) => !heldUnknownStatements.has(statement))
            .map((statement) => ({
              statement,
              drives_clarification: true,
            })),
        ].slice(0, 8),
      },
    };
  }

  return {
    ...finalized,
    final_output: foundationOutput,
    care_state_engine_layer,
    single_user_journey_layer,
    product_north_star_layer: product_north_star_enforced,
    product_constitution_layer,
    continuity_properties_layer,
    care_reality_intelligence_layer,
    care_reality_engine_layer,
    care_signal_understanding_layer,
    generalized_care_understanding_layer,
    // Phase 10 — Care Identity: surface continuity summary and decision for composer branching.
    care_identity_summary: identitySummary ?? undefined,
    continuity_decision: continuityDecision,
    // care_key = contributor session identity; Care Reality id is context.care_recipient_id.
    care_key: caregiverId,
    resolution_engine_layer: trackedSync.resolution_engine_layer,
    active_situations: trackedSync.active.map((t) =>
      toActiveSituation(trackedSituationToUiSituation(t)),
    ),
    ui_situations: trackedSync.ui_situations.filter((s) => s.status !== "resolved"),
    active_care_situation: acsTurn.situation,
    active_care_situation_turn: acsTurn,
    care_situation_groups,
};
}

/**
 * Intelligence-boundary entry point — routes through the SolenOS Intelligence
 * Layer while preserving full engine stack compatibility for backward compatibility.
 *
 * This is the canonical caregiver path: Intent → Memory → Data Acquisition →
 * Understanding → Memory Strategy → Reasoning → Active Situation → Communication.
 */
export async function processSituationInputWithIntelligence(
  input: ProcessSituationInput,
): Promise<SituationResponse> {
  const { runIntelligencePipeline, buildMinimalFinalOutput } = await import(
    "../solenos-intelligence"
  );

  const intelligenceResult = await runIntelligencePipeline(input);

  const final_output = buildMinimalFinalOutput({
    understanding: intelligenceResult.understanding.understanding,
    composedResponse: intelligenceResult.composedResponse,
    continuityDecision: intelligenceResult.memory.continuityDecision,
    careRealityState: intelligenceResult.careRealityState,
    events: intelligenceResult.situationResponse.events_created,
  });

  const base = intelligenceResult.situationResponse;

  const situationResponse: SituationResponse = {
    ...base,
    final_output,
    care_key: intelligenceResult.input.caregiverId,
  };

  return situationResponse;
}

/**
 * Re-enter the continuous execution loop after correction or idle refresh.
 * No new DARE ingest — diff and output are projections of current CareContext.
 */
export async function processSituationRecompile(input: {
  caregiver_id: string;
  trigger: "correction" | "idle_refresh";
  correction_event_id?: string | null;
}): Promise<SituationResponse | null> {
  const caregiverId = input.caregiver_id;
  const context = getCareContextRoot(caregiverId);
  if (!context || context.events.length === 0) return null;

  const priorContext = { ...context, events: context.events.slice(0, -1) };
  const continuous_execution_loop_layer = reprocessContinuousExecutionLoop({
    caregiver_id: caregiverId,
    trigger: input.trigger,
    context,
    correction_event_id: input.correction_event_id,
  });

  const recentEvents = context.events.slice(-3);
  const priorityQuery = queryPriorityEvents(context.events);
  const { understood, uncertain, clarification, tracked } = buildSituationUnderstanding(recentEvents);

  const mergedUncertainRecompile = [
    ...new Set([...uncertain, ...continuous_execution_loop_layer.open_uncertainties]),
  ];

  const clarificationRawRecompile = processClarificationEngine({
    caregiver_id: caregiverId,
    raw_input: "",
    events_created: recentEvents,
    what_is_uncertain: mergedUncertainRecompile,
  });
  const clarificationPolicyRecompile = applyPolicyToClarification(
    caregiverId,
    clarificationRawRecompile,
  );
  const clarification_engine_layer = clarificationPolicyRecompile.layer;

  const mergedClarification = sanitizeCaregiverFacingLines(
    [
      ...clarification_engine_layer.questions.map((q) => q.question),
      ...clarification,
      ...continuous_execution_loop_layer.open_uncertainties,
    ],
    Math.max(clarification_engine_layer.budget_max, 5),
    { asksOnly: true },
  );

  const memory = processMemoryLayers({
    caregiver_id: caregiverId,
    events: context.events,
    unresolved_questions: mergedClarification,
  });

  const memory_strategy_layer = processMemoryStrategy({
    caregiver_id: caregiverId,
    events_created: recentEvents,
    all_events: context.events,
    as_of: new Date().toISOString(),
  });

  const failureResilience = processFailureResilience({
    caregiver_id: caregiverId,
    dare: null,
    events_created: [],
    prior_events: priorContext.events,
    raw_input: "",
  });

  const trustProvenance = processTrustProvenance({
    caregiver_id: caregiverId,
    events_created: [],
    context_events: context.events,
    dare: null,
    unresolved_questions: mergedClarification,
    what_changed: continuous_execution_loop_layer.what_changed,
    capture_provenance: null,
  });

  const networkEffectMoat = processNetworkEffectMoat({
    caregiver_id: caregiverId,
    new_events: [],
    prior_events: priorContext.events,
    all_events: context.events,
    unresolved_questions: mergedClarification,
    what_changed: continuous_execution_loop_layer.what_changed,
    dare: null,
    prior_link_count: memory.store.structured.links.length,
  });

  const successModel = processSuccessModel({
    caregiver_id: caregiverId,
    events: context.events,
    events_created: [],
    what_changed: continuous_execution_loop_layer.what_changed,
    unresolved_questions: mergedClarification,
    dare: null,
    failure: failureResilience,
    trust: trustProvenance,
    moat: networkEffectMoat,
    top_event_ids: priorityQuery.top_events.map((e) => e.id),
    attention_event_ids: priorityQuery.attention_events.map((e) => e.id),
    context_window_chars: estimateContextWindowSize(memory.context_window),
    has_active_episode: memory.store.active_episode_id !== null,
  });

  const behavior_interpretation_layer = processBehaviorInterpretation({
    caregiver_id: caregiverId,
    events_created: recentEvents,
    all_events: context.events,
    prior_events: priorContext.events,
    what_changed: continuous_execution_loop_layer.what_changed,
  });

  const baseline_intelligence_layer = processBaselineIntelligence({
    caregiver_id: caregiverId,
    care_recipient_id: context.care_recipient_id,
    events_created: recentEvents,
    all_events: context.events,
    raw_input: "",
    as_of: new Date().toISOString(),
  });

  const continuity_decay_layer = processContinuityDecay({
    caregiver_id: caregiverId,
    all_events: context.events,
    events_created: recentEvents,
    what_needs_clarification: mergedClarification,
    what_is_uncertain: [...new Set([...uncertain, ...continuous_execution_loop_layer.open_uncertainties])],
    attention_event_ids: priorityQuery.attention_events.map((e) => e.id),
    what_changed: continuous_execution_loop_layer.what_changed,
    as_of: new Date().toISOString(),
    trigger: input.trigger === "idle_refresh" ? "idle_refresh" : "background",
  });

  const north_star_experience_layer = processNorthStarExperience({
    caregiver_id: caregiverId,
    raw_input: "",
    is_first_situation: false,
    events_created: recentEvents,
    all_events: context.events,
    prior_event_count: priorContext.events.length,
    what_changed: continuous_execution_loop_layer.what_changed,
    what_i_understood: understood,
    what_is_uncertain: [...new Set([...uncertain, ...continuous_execution_loop_layer.open_uncertainties])],
    what_needs_clarification: mergedClarification,
    has_decision_trace: true,
    has_confidence_surface: true,
  });

  const trust_layer_engine_layer = processTrustLayerEngine({
    caregiver_id: caregiverId,
    events_created: recentEvents,
    all_events: context.events,
    what_is_uncertain: [...new Set([...uncertain, ...continuous_execution_loop_layer.open_uncertainties])],
    what_needs_clarification: mergedClarification,
    trust_provenance: trustProvenance,
    behavior: behavior_interpretation_layer,
    continuity_decay: continuity_decay_layer,
    memory_strategy: memory_strategy_layer,
    clarification: clarification_engine_layer,
    attention_event_ids: priorityQuery.attention_events.map((e) => e.id),
    as_of: new Date().toISOString(),
  });

  const crisis_mode_interaction_layer = processCrisisModeInteraction({
    caregiver_id: caregiverId,
    raw_input: "",
    events_created: recentEvents,
    all_events: context.events,
    behavior: behavior_interpretation_layer,
    attention_event_ids: priorityQuery.attention_events.map((e) => e.id),
    what_changed: continuous_execution_loop_layer.what_changed,
    as_of: new Date().toISOString(),
  });

  const multi_caregiver_context_layer = processMultiCaregiverContext({
    caregiver_id: caregiverId,
    care_recipient_id: context.care_recipient_id,
    events_created: recentEvents,
    all_events: context.events,
    what_changed: continuous_execution_loop_layer.what_changed,
    as_of: new Date().toISOString(),
  });

  const audit_trail_layer = processAuditTrail({
    care_recipient_id: context.care_recipient_id,
    events_created_count: recentEvents.length,
  });

  const state_of_care_summary_layer = processStateOfCareSummary({
    caregiver_id: caregiverId,
    context,
    events_created: recentEvents,
    what_changed: continuous_execution_loop_layer.what_changed,
    what_is_uncertain: [...new Set([...uncertain, ...continuous_execution_loop_layer.open_uncertainties])],
    what_needs_clarification: [
      ...new Set([
        ...mergedClarification,
        ...multi_caregiver_context_layer.clarification_needed,
      ]),
    ],
    behavior: behavior_interpretation_layer,
    continuity_decay: continuity_decay_layer,
    trust_layer: trust_layer_engine_layer,
    multi_caregiver: multi_caregiver_context_layer,
    crisis_mode: crisis_mode_interaction_layer,
    attention_event_ids: priorityQuery.attention_events.map((e) => e.id),
    as_of: new Date().toISOString(),
  });

  const careContextDiffRawRecompile = processCareContextDiff({
    caregiver_id: caregiverId,
    prior_context: priorContext,
    context,
    events_created: recentEvents,
    state_diff: continuous_execution_loop_layer.diff,
    what_changed: continuous_execution_loop_layer.what_changed,
    behavior: behavior_interpretation_layer,
    continuity_decay: continuity_decay_layer,
    multi_caregiver: multi_caregiver_context_layer,
    state_of_care: state_of_care_summary_layer.summary,
    attention_event_ids: priorityQuery.attention_events.map((e) => e.id),
    as_of: new Date().toISOString(),
  });
  const diffPolicyRecompile = applyPolicyToDiff(caregiverId, careContextDiffRawRecompile.diff);
  const care_context_diff_layer = {
    ...careContextDiffRawRecompile,
    diff: diffPolicyRecompile.sanitized_diff ?? careContextDiffRawRecompile.diff,
  };

  const care_reality_profile_layer = processCareRealityProfile({
    care_recipient_id: context.care_recipient_id,
    all_events: context.events,
    baseline: baseline_intelligence_layer,
    behavior: behavior_interpretation_layer,
    memory_strategy: memory_strategy_layer,
    what_is_uncertain: mergedUncertainRecompile,
    what_needs_clarification: [
      ...new Set([
        ...mergedClarification,
        ...multi_caregiver_context_layer.clarification_needed,
      ]),
    ],
    as_of: new Date().toISOString(),
  });

  const moment_of_need_layer = processMomentOfNeed({
    raw_input: "",
    events_created: recentEvents,
    all_events: context.events,
    baseline: baseline_intelligence_layer,
    care_reality_profile: care_reality_profile_layer,
    care_context_diff: care_context_diff_layer,
    behavior: behavior_interpretation_layer,
    what_is_uncertain: mergedUncertainRecompile,
    as_of: new Date().toISOString(),
  });

  const care_timeline_engine_layer = processCareTimelineEngine({
    caregiver_id: caregiverId,
    care_recipient_id: context.care_recipient_id,
    events: context.events,
    events_created: recentEvents,
    multi_caregiver: multi_caregiver_context_layer,
    as_of: new Date().toISOString(),
  });

  const timeline_reconstruction_layer = processTimelineReconstruction({
    caregiver_id: caregiverId,
    raw_input: "",
    events: context.events,
    events_created: recentEvents,
    as_of: new Date().toISOString(),
  });

  const contradiction_detection_layer = processContradictionDetection({
    caregiver_id: caregiverId,
    care_recipient_id: context.care_recipient_id,
    events: context.events,
    events_created: recentEvents,
    care_timeline: care_timeline_engine_layer,
    as_of: new Date().toISOString(),
  });

  const care_state_change_report = detectCareStateChanges({
    priorContext: priorContext,
    currentContext: context,
    eventsCreated: recentEvents,
    baselineFacts: baseline_intelligence_layer.baseline_facts,
    baselineDeviations: baseline_intelligence_layer.deviations,
    contradictions: {
      open_contradictions: contradiction_detection_layer.open_contradictions.map((c) => ({
        field: c.field,
        event_ids: c.event_ids,
        shared_message: c.shared_message,
        affects_safety: c.affects_safety,
      })),
      change_classifications: [],
    },
  });

  const recompileTimelineCreated = recentEvents
    .map(mapCanonicalToTimelineEvent)
    .filter((e): e is NonNullable<typeof e> => e !== null);

  const task_extraction_layer = processTaskExtraction({
    caregiver_id: caregiverId,
    care_recipient_id: context.care_recipient_id,
    timeline_events: care_timeline_engine_layer.care_truth.timeline,
    events_created: recompileTimelineCreated,
  });

  const current_state_view_layer = processCurrentStateView({
    care_recipient_id: context.care_recipient_id,
    care_record: care_timeline_engine_layer.care_record,
    care_truth: care_timeline_engine_layer.care_truth,
    tasks: task_extraction_layer.tasks,
    what_matters_most: state_of_care_summary_layer.summary.what_matters_most,
    as_of: new Date().toISOString(),
  });

  const adoption_wedge_layer = processAdoptionWedge({
    caregiver_id: caregiverId,
    is_first_situation: false,
    events_created_count: 0,
    care_timeline: care_timeline_engine_layer,
    current_state: current_state_view_layer,
    tasks: task_extraction_layer,
    entry_mode: undefined,
  });

  const product_reality_model_layer = processProductRealityModel({
    has_contradictions:
      care_timeline_engine_layer.conflicts_detected > 0 ||
      contradiction_detection_layer.open_contradictions.length > 0,
    contradiction_count:
      care_timeline_engine_layer.conflicts_detected +
      contradiction_detection_layer.open_contradictions.length,
    has_uncertainty: uncertain.length > 0,
    uncertainty_count: uncertain.length,
    events_appended: 0,
    state_derived: true,
    manual_state_edit: false,
  });

  const care_state_engine_layer = processCareStateEngine({
    care_recipient_id: context.care_recipient_id,
    all_events: context.events,
    events_created: [],
    what_is_uncertain: mergedUncertainRecompile,
    what_needs_clarification: [
      ...new Set([
        ...mergedClarification,
        ...multi_caregiver_context_layer.clarification_needed,
        ...contradiction_detection_layer.clarification_triggers,
      ]),
    ],
    care_context_diff: care_context_diff_layer,
    state_of_care: state_of_care_summary_layer,
    as_of: new Date().toISOString(),
  });

  const situationResponse = {
    what_i_understood: understood,
    what_is_uncertain: [...new Set([...uncertain, ...continuous_execution_loop_layer.open_uncertainties])],
    what_needs_clarification: [
      ...new Set([
        ...mergedClarification,
        ...multi_caregiver_context_layer.clarification_needed,
        ...contradiction_detection_layer.clarification_triggers,
        ...timeline_reconstruction_layer.clarification_triggers,
      ]),
    ],
    what_will_be_tracked: tracked,
    what_changed: continuous_execution_loop_layer.what_changed,
    what_merged_or_split: [],
    events_created: [],
    context,
    is_first_situation: false,
    document_events_count: context.events.filter((e) => e.source === "document").length,
    dare: null,
    timeline_views: getTimelineViews(context.events),
    integrity_summary: {
      provisional_in_graph: filterByStatus(context.events, ["provisional"]).length,
      unparsed_in_graph: filterByStatus(context.events, ["unparsed_raw"]).length,
      invalidated: filterByStatus(context.events, ["invalidated"]).length,
      superseded: filterByStatus(context.events, ["superseded"]).length,
    },
    priority_layer: {
      top_events: priorityQuery.top_events.map((e) => e.id),
      attention_events: priorityQuery.attention_events.map((e) => e.id),
      hidden_count: priorityQuery.hidden_count,
    },
    memory_layer: {
      active_episode_id: memory.store.active_episode_id,
      episode_count: memory.store.episodes.length,
      long_term_summary_count: memory.store.long_term_summaries.length,
      total_raw_events: memory.store.raw_event_refs.length,
      retrieval_order: [...memory.retrieval.retrieval_order],
      context_window_chars: estimateContextWindowSize(memory.context_window),
    },
    failure_resilience_layer: {
      failures: failureResilience.failures,
      confidence_summaries: failureResilience.confidence_summaries,
      pending_processing: failureResilience.pending_processing,
      outcomes_applied: failureResilience.outcomes_applied,
      processing_status: failureResilience.processing_status,
      recovery_actions: failureResilience.recovery_actions,
      continuity_preserved: failureResilience.continuity_preserved,
    },
    trust_provenance_layer: {
      provenance_records: trustProvenance.provenance_records,
      trust_indicators: trustProvenance.trust_indicators,
      audit_trail_summary: trustProvenance.audit_trail_summary,
      evidence_bundles: trustProvenance.evidence_bundles,
      reasoning_chains: trustProvenance.reasoning_chains,
      confidence_assessment: trustProvenance.confidence_assessment,
      retrieval_context: trustProvenance.retrieval_context,
      generation_boundaries: trustProvenance.generation_boundaries,
      insufficient_evidence_message: trustProvenance.insufficient_evidence_message,
    },
    network_effect_moat_layer: {
      interaction_outcomes: networkEffectMoat.interaction_outcomes,
      enrichment_actions: networkEffectMoat.enrichment_actions,
      entity_matches: networkEffectMoat.entity_matches,
      event_matches: networkEffectMoat.event_matches,
      resolved_uncertainties: networkEffectMoat.resolved_uncertainties,
      new_relationships: networkEffectMoat.new_relationships,
      compounding_metrics: networkEffectMoat.compounding_metrics,
      moat_strength: networkEffectMoat.moat_strength,
      maturity_stage: networkEffectMoat.maturity_stage,
      maturity_message: networkEffectMoat.maturity_message,
      context_grew: networkEffectMoat.context_grew,
      isolated_records: networkEffectMoat.isolated_records,
    },
    success_model_layer: {
      primary: successModel.primary,
      system_quality: successModel.system_quality,
      user_trust: successModel.user_trust,
      longitudinal: successModel.longitudinal,
      overall_success_score: successModel.overall_success_score,
      overall_level: successModel.overall_level,
      outcome_summary: successModel.outcome_summary,
      recall_probes: successModel.recall_probes,
      activity_metrics_excluded: successModel.activity_metrics_excluded,
    },
    continuous_execution_loop_layer,
    behavior_interpretation_layer,
    baseline_intelligence_layer,
    continuity_decay_layer,
    north_star_experience_layer,
    clarification_engine_layer,
    memory_strategy_layer,
    trust_layer_engine_layer,
    crisis_mode_interaction_layer,
    multi_caregiver_context_layer,
    audit_trail_layer,
    state_of_care_summary_layer,
    care_context_diff_layer,
    care_reality_profile_layer,
    moment_of_need_layer,
    care_timeline_engine_layer,
    timeline_reconstruction_layer,
    contradiction_detection_layer,
    care_state_change_report,
    task_extraction_layer,
    current_state_view_layer,
    adoption_wedge_layer,
    product_reality_model_layer,
    care_state_engine_layer,
    policy_engine_layer: buildPolicyEngineLayer(caregiverId),
  };

  const arbitration = processRuntimeArbitrationLayers({
    caregiver_id: caregiverId,
    response: situationResponse,
    is_session_reentry: input.trigger === "idle_refresh",
    is_return_session: false,
    as_of: new Date().toISOString(),
  });

  const withArbitration = { ...situationResponse, ...arbitration };

  const mvp_surface_area_layer = processMvpSurfaceArea({
    caregiver_id: caregiverId,
    response: withArbitration,
    is_return_session: true,
  });

  const withMvpLayer = { ...withArbitration, mvp_surface_area_layer };
  const { final_output, architectural_boundaries_layer } = enforceCompiledDominantOutput(
    withMvpLayer,
    arbitration.priority_resolution_layer,
    arbitration.edge_state_layer,
  );

  return finalizeSituationResponse(withMvpLayer, final_output, architectural_boundaries_layer);
}

export function getSituationTimeline(caregiverId: string) {
  const ctx = getCareContextRoot(caregiverId);
  if (!ctx) {
    return {
      temporal_timeline: [],
      ingestion_timeline: [],
      timeline_views: { temporal_order: [], ingestion_order: [] },
      top_events: [],
      attention_events: [],
    };
  }
  const priorityQuery = queryPriorityEvents(ctx.events);
  return {
    temporal_timeline: getTemporalTimeline(ctx.events),
    ingestion_timeline: getIngestionTimeline(ctx.events),
    timeline_views: getTimelineViews(ctx.events),
    top_events: priorityQuery.top_events,
    attention_events: priorityQuery.attention_events,
  };
}

export function getTopSituationEvents(caregiverId: string, limit = 5) {
  const ctx = getCareContextRoot(caregiverId);
  if (!ctx) return [];
  return getTopEvents(ctx.events, limit);
}

/**
 * SESSION_REENTRY_EVENT — reconstruct CareContext state; never chat.
 * Greetings and empty inputs trigger State of Care Summary or ingestion-ready wedge.
 */
export async function processSessionReentry(input: {
  caregiver_id: string;
  raw_input: string;
  timestamp?: string;
}): Promise<SituationResponse> {
  const classification = classifyEntryInput({
    raw_input: input.raw_input,
    has_documents: false,
  });

  const context = getCareContextRoot(input.caregiver_id);
  if (!context || context.events.length === 0) {
    return buildInitializationSituationResponse(input.caregiver_id, classification);
  }

  const recompiled = await processSituationRecompile({
    caregiver_id: input.caregiver_id,
    trigger: "idle_refresh",
  });

  if (!recompiled) {
    return buildInitializationSituationResponse(input.caregiver_id, classification);
  }

  const entry_behavior_layer = buildEntryBehaviorLayer({
    mode: "session_reentry",
    classification,
    state_reconciled: true,
  });

  const withEntry: SituationResponse = { ...recompiled, entry_behavior_layer };

  const retention_engine_layer = processRetentionEngine({
    caregiver_id: input.caregiver_id,
    context: withEntry.context,
    care_context_diff: withEntry.care_context_diff_layer,
    continuity_decay: withEntry.continuity_decay_layer,
    contradiction_detection: withEntry.contradiction_detection_layer,
    tasks: withEntry.task_extraction_layer,
    state_of_care: withEntry.state_of_care_summary_layer,
    as_of: input.timestamp ?? new Date().toISOString(),
  });

  const withRetention: SituationResponse = { ...withEntry, retention_engine_layer };

  const arbitration = processRuntimeArbitrationLayers({
    caregiver_id: input.caregiver_id,
    response: withRetention,
    is_session_reentry: true,
    is_return_session: retention_engine_layer.return_state.is_return_session,
    as_of: input.timestamp ?? new Date().toISOString(),
  });

  const withArbitration = { ...withRetention, ...arbitration };

  const mvp_surface_area_layer = processMvpSurfaceArea({
    caregiver_id: input.caregiver_id,
    response: withArbitration,
    is_return_session: retention_engine_layer.return_state.is_return_session,
  });

  const withMvp = { ...withArbitration, mvp_surface_area_layer } as SituationResponse;
  const { final_output: enforced, architectural_boundaries_layer } = enforceCompiledDominantOutput(
    withMvp,
    arbitration.priority_resolution_layer,
    arbitration.edge_state_layer,
  );

  const finalized = finalizeSituationResponse(withMvp, enforced, architectural_boundaries_layer);
  recordSessionVisit({
    caregiver_id: input.caregiver_id,
    care_recipient_id: finalized.context.care_recipient_id,
    event_count: finalized.context.events.length,
    context_updated_at: finalized.context.updated_at,
    visited_at: input.timestamp ?? finalized.context.updated_at,
  });
  return finalized;
}

function buildInitializationSituationResponse(
  caregiverId: string,
  classification: ReturnType<typeof classifyEntryInput>,
): SituationResponse {
  const context = getOrCreateCareContextRoot(caregiverId);
  const entry_behavior_layer = buildEntryBehaviorLayer({
    mode: "initialization",
    classification,
    state_reconciled: false,
  });

  const adoption_wedge_layer = processAdoptionWedge({
    caregiver_id: caregiverId,
    is_first_situation: true,
    events_created_count: 0,
    entry_mode: "initialization",
  });

  const product_reality_model_layer = processProductRealityModel({
    has_contradictions: false,
    contradiction_count: 0,
    has_uncertainty: true,
    uncertainty_count: 1,
    events_appended: 0,
    state_derived: false,
    manual_state_edit: false,
  });

  const response = {
    what_i_understood: [],
    what_is_uncertain: ["Care record not yet established — awaiting first input."],
    what_needs_clarification: [],
    what_will_be_tracked: [],
    what_changed: [],
    what_merged_or_split: [],
    events_created: [],
    context,
    is_first_situation: true,
    document_events_count: 0,
    dare: null,
    timeline_views: { temporal_order: [], ingestion_order: [] },
    integrity_summary: {
      provisional_in_graph: 0,
      unparsed_in_graph: 0,
      invalidated: 0,
      superseded: 0,
    },
    priority_layer: { top_events: [], attention_events: [], hidden_count: 0 },
    entry_behavior_layer,
    adoption_wedge_layer,
    product_reality_model_layer,
  } as unknown as Omit<
    SituationResponse,
    "mvp_surface_area_layer" | "architectural_boundaries_layer" | "final_output"
  >;

  const arbitration = processRuntimeArbitrationLayers({
    caregiver_id: caregiverId,
    response: response as SituationResponse,
    is_session_reentry: false,
    is_return_session: false,
  });

  const withArbitration = { ...response, ...arbitration };

  const mvp_surface_area_layer = processMvpSurfaceArea({
    caregiver_id: caregiverId,
    response: withArbitration,
    is_return_session: false,
  });

  const withMvp = { ...withArbitration, mvp_surface_area_layer } as SituationResponse;
  const { final_output: enforced, architectural_boundaries_layer } = enforceCompiledDominantOutput(
    withMvp,
    arbitration.priority_resolution_layer,
    arbitration.edge_state_layer,
  );

  return finalizeSituationResponse(withMvp, enforced, architectural_boundaries_layer);
}

function buildForbiddenOutputSurfaces(
  response: Pick<SituationResponse, "adoption_wedge_layer">,
  final_output: FinalOutputContract,
): Record<string, string | string[]> {
  return {
    what_is_happening: final_output.what_is_happening,
    what_matters_now: final_output.what_matters_now,
    what_to_ask_next: final_output.what_to_ask_next,
    what_can_wait: final_output.what_can_wait,
    follow_up_items: final_output.follow_up_items,
    ...(response.adoption_wedge_layer
      ? {
          wedge_summary: response.adoption_wedge_layer.sections.structured_summary_of_chaos,
          wedge_state: response.adoption_wedge_layer.sections.current_state_snapshot,
          wedge_actions: response.adoption_wedge_layer.sections.actionable_output,
        }
      : {}),
  };
}

function finalizeSituationResponse(
  withMvpLayer: Omit<SituationResponse, "final_output" | "forbidden_build_zone_layer">,
  final_output: FinalOutputContract,
  architectural_boundaries_layer: SituationResponse["architectural_boundaries_layer"],
): SituationResponse {
  const caregiverId = withMvpLayer.context?.caregiver_id ?? "default_caregiver";
  const policyApplied = applyPolicyToFinalOutput(caregiverId, final_output, {
    medical_advice_request:
      withMvpLayer.policy_engine_layer?.ingestion?.medical_advice_request === true,
    consent_required: withMvpLayer.policy_engine_layer?.consent_required === true,
    soft_consent_prompt:
      withMvpLayer.policy_engine_layer?.ingestion?.soft_consent_prompt ?? null,
  });
  const care_transparency_layer = processCareTransparency({
    response: withMvpLayer,
    final_output_draft: policyApplied,
  });
  const outputWithTransparency = attachTransparencyToFinalOutput(
    policyApplied,
    care_transparency_layer.panel,
  );

  const outputPolicy = validateOutputPolicy({
    user_id: caregiverId,
    surfaces: {
      what_is_happening: outputWithTransparency.what_is_happening,
      what_matters_now: outputWithTransparency.what_matters_now,
      what_to_ask_next: outputWithTransparency.what_to_ask_next,
    },
  });

  const forbidden_build_zone_layer = processForbiddenBuildZone({
    output_surfaces: buildForbiddenOutputSurfaces(withMvpLayer, outputWithTransparency),
  });

  const policy_engine_layer = {
    ...(withMvpLayer.policy_engine_layer ?? buildPolicyEngineLayer(caregiverId)),
    output: outputPolicy,
  };

  const finalized = {
    ...withMvpLayer,
    architectural_boundaries_layer,
    final_output: outputWithTransparency,
    forbidden_build_zone_layer,
    policy_engine_layer,
    care_transparency_layer,
  } as SituationResponse;

  return sanitizeSituationUncertaintyFields(finalized);
}
