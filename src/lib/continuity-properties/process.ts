import type { CanonicalCareEvent } from "../situation-entry/types";
import {
  createEmptyOMLState,
  emitOutcomeMeasurement,
} from "../oml";
import type { CareContext } from "../care-context/types";
import { classifySourceReliability } from "./source-reliability";
import { deriveExplicitUnknowns } from "../unknowns-engine";
import { classifyFailureFromQuestion } from "./failure-map";
import {
  recordInference,
  listPendingInferences,
  getLearningHistory,
} from "./inference-learning";
import { projectPresentation, type PresentationMode } from "../presentation-engine";
import {
  buildEvidenceObject,
  buildEvidencedConclusion,
  type EvidencedConclusion,
} from "../evidence-preservation";
import {
  defaultPrivacyMeta,
  type CareEventPrivacyMeta,
} from "../privacy-institutional-contracts";
import type { ContinuityPropertiesResult } from "./types";

const omlByCaregiver = new Map<string, ReturnType<typeof createEmptyOMLState>>();

export function resetContinuityPropertiesStore(): void {
  omlByCaregiver.clear();
}

/**
 * Vertical Continuity properties — one system, not separate products.
 */
export function processContinuityProperties(input: {
  caregiver_id: string;
  care_recipient_id?: string;
  raw_input?: string;
  all_events: CanonicalCareEvent[];
  events_created: CanonicalCareEvent[];
  what_is_happening?: string;
  what_changed?: string[];
  what_needs_clarification?: string[];
  what_needs_attention?: string[];
  what_is_stable?: string[];
  conflict_count?: number;
  has_meaningful_diff?: boolean;
  clarification_question_count?: number;
  presentation_mode?: PresentationMode;
  clinical_profile_id?: string;
}): ContinuityPropertiesResult {
  const ownership = input.care_recipient_id ?? input.caregiver_id;

  const source_reliability_on_events = input.all_events.map((e) => ({
    event_id: e.id,
    source_reliability:
      e.source_reliability ??
      classifySourceReliability({
        source: e.source,
        raw_input: e.raw_input,
        attribution_source_type: e.source_attribution?.source_type,
      }),
  }));

  const privacy_on_events: Array<{ event_id: string; privacy: CareEventPrivacyMeta }> =
    input.all_events.map((e) => ({
      event_id: e.id,
      privacy:
        e.privacy ??
        defaultPrivacyMeta({
          ownership_scope: ownership,
          is_document: e.source === "document",
        }),
    }));

  const known = [
    ...(input.what_is_happening ? [input.what_is_happening] : []),
    ...input.all_events.slice(-5).map((e) => e.raw_input.slice(0, 100)),
  ];
  const inferred = [
    ...(input.what_changed ?? []),
    ...(input.has_meaningful_diff ? ["Meaningful care-state change detected"] : []),
  ];

  const explicit_unknowns = deriveExplicitUnknowns({
    known,
    inferred,
    event_texts: input.all_events.map((e) => e.raw_input),
    unresolved_clarifications: input.what_needs_clarification ?? [],
    conflict_count: input.conflict_count ?? 0,
    related_care_event_ids: input.all_events.map((e) => e.id),
    clinical_profile_id: input.clinical_profile_id ?? "dementia",
  });

  let omlState = omlByCaregiver.get(input.caregiver_id) ?? createEmptyOMLState();
  const bridgeContext: CareContext = {
    timeline: input.all_events.map((e) => ({
      id: e.id,
      date: e.timestamp,
      dateLabel: e.timestamp,
      description: e.raw_input.slice(0, 160),
      type: "observation" as const,
      source: e.source === "document" ? "note" : "observation",
      recordedAt: e.ingestion_time,
    })),
    recentChanges: (input.what_changed ?? []).map((description) => ({
      description,
      detectedAt: new Date().toISOString(),
      category: "other" as const,
      evidence: [],
    })),
    uncertainties: [
      ...explicit_unknowns.explicit_unknowns.map((u) => u.missing_information),
      ...(input.what_needs_clarification ?? []),
    ],
    prioritizedActions: [],
    updatedAt: new Date().toISOString(),
  };

  if ((input.clarification_question_count ?? 0) > 0) {
    omlState = {
      ...omlState,
      clarifications: [
        ...omlState.clarifications,
        {
          question: `budgeted:${input.clarification_question_count}`,
          askedAt: new Date().toISOString(),
          resolved: false,
          repeated: false,
        },
      ],
    };
  }

  const { measurement, updatedOmlState } = emitOutcomeMeasurement(bridgeContext, omlState);
  omlByCaregiver.set(input.caregiver_id, updatedOmlState);

  const recorded_inferences = [];
  if (input.what_is_happening || (input.what_changed?.length ?? 0) > 0) {
    const inf = recordInference({
      inference_id: `inf_${input.caregiver_id}_${Date.now()}`,
      care_event_ids: input.events_created.map((e) => e.id),
      output_summary:
        input.what_changed?.[0] ?? input.what_is_happening ?? "CareContext update",
      confidence_score: measurement.snapshot.caregiverCognitiveLoadScore.score
        ? Math.max(0.2, 1 - measurement.snapshot.caregiverCognitiveLoadScore.score / 100)
        : 0.55,
      engine_source: input.has_meaningful_diff
        ? "care_context_diff_engine"
        : "state_of_care_summary_engine",
      created_at: new Date().toISOString(),
    });
    recorded_inferences.push(inf);
  }

  const avgReliability =
    source_reliability_on_events.length > 0
      ? source_reliability_on_events.reduce(
          (s, x) => s + x.source_reliability.reliability_score,
          0,
        ) / source_reliability_on_events.length
      : 0.5;

  const evidence_conclusion: EvidencedConclusion | null =
    input.what_changed?.[0] || input.what_is_happening
      ? buildEvidencedConclusion({
          recommendation:
            input.what_changed?.[0] ??
            input.what_is_happening ??
            "Current CareContext updated",
          implied_action: input.what_needs_attention?.[0] ?? null,
          evidence: buildEvidenceObject({
            event_ids: input.events_created.map((e) => e.id).slice(-8),
            timeline_labels: input.all_events.slice(-6).map(
              (e) => `${e.extracted_type}: ${e.raw_input.slice(0, 80)}`,
            ),
            observation_type: input.has_meaningful_diff ? "mixed" : "direct",
            confidence_score: Math.max(
              0.2,
              1 - measurement.snapshot.caregiverCognitiveLoadScore.score / 100,
            ),
            source_reliability_score: avgReliability,
            reasoning_summary: input.has_meaningful_diff
              ? "Derived from CareEvent timeline + Diff against prior CareContext"
              : "Derived from accumulated CareEvents in the Living Care Record",
            what_would_increase_confidence: explicit_unknowns.explicit_unknowns
              .filter((u) => u.priority === "critical" || u.priority === "high")
              .slice(0, 3)
              .map((u) => `Resolve unknown: ${u.missing_information}`),
          }),
        })
      : null;

  const presentation = projectPresentation(
    {
      what_changed: input.what_changed ?? [],
      what_is_happening: known.slice(0, 5),
      what_needs_attention: input.what_needs_attention ?? [],
      what_is_stable: input.what_is_stable ?? [],
      known: explicit_unknowns.known,
      inferred: explicit_unknowns.inferred,
      explicit_unknowns: explicit_unknowns.explicit_unknowns.map((u) => ({
        missing_information: u.missing_information,
        priority: u.priority,
        reason_it_matters: u.reason_it_matters,
      })),
      confidence_notes: evidence_conclusion
        ? [evidence_conclusion.layers.confidence]
        : [],
      evidence_summaries: evidence_conclusion?.layers.evidence ?? [],
    },
    { mode: input.presentation_mode ?? "standard" },
  );

  const failure_signals = input.raw_input
    ? classifyFailureFromQuestion(input.raw_input)
    : null;

  return {
    active: true,
    one_system: true,
    source_reliability_on_events,
    privacy_on_events,
    explicit_unknowns,
    outcome_measurement: measurement,
    failure_signals,
    recorded_inferences: recorded_inferences.length
      ? recorded_inferences
      : listPendingInferences().slice(-3),
    learning_updates: getLearningHistory().slice(-5),
    presentation,
    evidence_conclusion,
    clinical_profile_id: explicit_unknowns.clinical_profile_id,
    invariants: {
      questions_are_symptoms: true,
      reliability_is_not_confidence: true,
      unknowns_are_structured: true,
      feedback_must_be_explicit: true,
      measure_uncertainty_reduction: true,
      presentation_does_not_mutate_truth: true,
      institutions_are_projections_only: true,
      dementia_is_profile_not_architecture: true,
    },
    defining_principle:
      "One Continuity system — Unknowns/Evidence/Presentation/Privacy are properties of CareEvent→CareContext, not separate products. Dementia is the first profile.",
  };
}
