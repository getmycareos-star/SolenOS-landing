import {
  BRAND_PROMISE,
  EXTERNAL_TAGLINE,
  INTERNAL_MOTTO,
  MVP_PRIORITY_ORDER,
  PRIMARY_FEELING,
  PRODUCT_CATEGORY,
  PRODUCT_CONSTITUTION_DEFINING_PRINCIPLE,
  PRODUCT_CONSTITUTION_MISSION,
  PRODUCT_CONSTITUTION_WORLDVIEW,
  PRODUCT_MOMENTS,
  PRODUCT_ULTIMATE_METRIC,
  CONSTITUTION_RULES,
} from "./contract-constants";
import { evaluateFeatureAgainstConstitution } from "./evaluate-feature";
import {
  projectCareRecordModel,
  projectDailyCareConfidence,
} from "./project-care-record";
import type {
  ProcessProductConstitutionInput,
  ProductConstitutionResult,
} from "./types";

export function processProductConstitution(
  input: ProcessProductConstitutionInput,
): ProductConstitutionResult {
  const asOf = input.as_of ?? new Date().toISOString();
  const unknowns = [
    ...input.what_is_uncertain,
    ...input.what_needs_clarification,
  ];

  const care_record = projectCareRecordModel({
    care_recipient_id: input.care_recipient_id,
    events: input.all_events,
    unknowns,
    as_of: asOf,
    care_state: input.care_state ?? null,
    subject_label: input.subject_label ?? null,
  });

  const recent_changes = [
    ...(input.what_changed ?? []),
    ...(input.care_state?.recent_changes ?? []),
    ...(input.care_context_diff?.diff.sections.factual_delta ?? []),
  ].slice(0, 6);

  const needs_attention = [
    ...(input.care_state?.needs_attention ?? []),
    ...(input.state_of_care?.summary.sections.what_needs_attention ?? []),
  ].slice(0, 5);

  const what_is_stable = [
    ...(input.care_state?.what_is_stable ?? []),
    ...(input.state_of_care?.summary.sections.what_is_stable ?? []),
  ];

  const daily_care_confidence = projectDailyCareConfidence({
    care_record,
    recent_changes,
    needs_attention,
    what_is_stable,
    what_matters_now: input.final_what_matters_now,
    what_can_wait: input.final_what_can_wait,
    event_count: input.all_events.filter(
      (e) => e.status !== "invalidated" && e.status !== "superseded",
    ).length,
  });

  const featureEval = input.proposed_feature
    ? evaluateFeatureAgainstConstitution(input.proposed_feature)
    : null;

  return {
    active: true,
    worldview: PRODUCT_CONSTITUTION_WORLDVIEW,
    mission: PRODUCT_CONSTITUTION_MISSION,
    category: PRODUCT_CATEGORY,
    ultimate_metric: PRODUCT_ULTIMATE_METRIC,
    primary_feeling: PRIMARY_FEELING,
    brand_promise: BRAND_PROMISE,
    tagline: EXTERNAL_TAGLINE,
    motto: INTERNAL_MOTTO,
    care_record,
    daily_care_confidence,
    mvp_priority: [...MVP_PRIORITY_ORDER],
    moments_supported: [...PRODUCT_MOMENTS],
    feature_gate_passed: featureEval ? featureEval.verdict === "pass" : true,
    documents_are_inputs_only: true,
    start_with_state_not_ui: true,
    memory_is_not_diagnosis: true,
    rules_upheld: [...CONSTITUTION_RULES],
    defining_principle: PRODUCT_CONSTITUTION_DEFINING_PRINCIPLE,
  };
}
