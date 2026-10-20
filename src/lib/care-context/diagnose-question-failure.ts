import type { CareContext } from "./types";
import type {
  QuestionFailureDiagnosis,
  SolenOSEngine,
} from "./failure-model-types";
import {
  classifyCaregiverFailure,
} from "./classify-failure";
import {
  matchQuestionToCapabilities,
} from "./question-capability-map";

const ENGINE_MODULE_MAP: Partial<Record<SolenOSEngine, string>> = {
  timeline_reconstruction: "engines/timeline-engine.ts",
  timeline_engine: "engines/timeline-engine.ts",
  diff_engine: "engines/diff-engine.ts",
  care_context: "apply-to-context.ts",
  contradiction_detection: "engines/contradiction-detection.ts",
  clarification_engine: "engines/clarification-engine.ts",
  prioritization_engine: "continuity-engine.ts",
  attention_budget: "engines/attention-budget.ts",
  care_transparency_panel: "opening-surface.ts",
  return_value_loop: "proactive-surface.ts",
  caregiver_load_engine: "engines/caregiver-load-engine.ts",
  state_of_care: "engines/state-of-care-engine.ts",
  pattern_learning_engine: "engines/pattern-learning-engine.ts",
  trust_layer: "engines/trust-layer.ts",
  confidence_layer: "engines/trust-layer.ts",
  uncertainty_layer: "engines/clarification-engine.ts",
  clinical_summary_generator: "../care-snapshot/build-snapshot.ts",
  visit_summaries: "../care-snapshot/build-snapshot.ts",
  clinician_reports: "../care-snapshot/format-plain-text.ts",
  immutable_care_events: "apply-to-context.ts",
  risk_engine: "engines/state-of-care-engine.ts",
  confidence_system: "engines/trust-layer.ts",
};

/**
 * Diagnose the continuity failure behind a caregiver question.
 * Delegates to failure-first classification when possible.
 */
export function diagnoseQuestionFailure(
  question: string,
  context?: CareContext,
): QuestionFailureDiagnosis {
  const failureFirst = classifyCaregiverFailure(question, context);
  const capabilityMatches = matchQuestionToCapabilities(question);

  const missingCapabilities = [
    ...new Set([
      ...failureFirst.productResponse,
      ...capabilityMatches.flatMap((m) => m.missingCapabilities),
    ]),
  ];

  const primaryCapability = capabilityMatches[0];
  const continuityFailureType =
    primaryCapability?.continuityFailure ?? "no_maintained_memory";
  const continuityFailure =
    primaryCapability?.continuityFailureDescription ??
    failureFirst.failureDescription;

  const buildInstead = missingCapabilities
    .map((e) => `${e}${ENGINE_MODULE_MAP[e] ? ` (${ENGINE_MODULE_MAP[e]})` : ""}`)
    .join(", ");

  const proactiveOutputs: string[] = [];
  if (failureFirst.canSurfaceProactively) {
    proactiveOutputs.push(
      ...failureFirst.openingSurface.whatChanged.slice(0, 2),
      ...failureFirst.openingSurface.whatNeedsAttention.slice(0, 2),
    );
  }

  return {
    question: question.trim(),
    continuityFailure,
    continuityFailureType,
    failureCategory: failureFirst.failureCategory,
    missingCapabilities,
    doNotBuild: failureFirst.doNotBuild,
    buildInstead: buildInstead || "CareContext maintenance and proactive surfacing",
    impliedMissingContext: failureFirst.impliedMissingContext,
    canSurfaceProactively: failureFirst.canSurfaceProactively,
    proactiveOutputs,
    productScope: failureFirst.productScope,
  };
}

export function formatFailureDiagnosis(d: QuestionFailureDiagnosis): string {
  const lines = [
    "FAILURE-FIRST DIAGNOSIS",
    "",
    `Question: ${d.question}`,
    `Failure category: ${d.failureCategory}`,
    `Failure: ${d.continuityFailure}`,
    `Product scope: ${d.productScope}`,
    "",
    "DO NOT BUILD:",
    `- ${d.doNotBuild}`,
    "",
    "PRODUCT RESPONSE:",
    ...d.missingCapabilities.map((c) => `- ${c}`),
    "",
  ];

  if (d.impliedMissingContext.length > 0) {
    lines.push("DISCONNECTED CONTEXT:");
    for (const c of d.impliedMissingContext) lines.push(`- ${c}`);
    lines.push("");
  }

  lines.push(
    `Proactive surfacing: ${d.canSurfaceProactively ? "yes" : "no"}`,
  );

  if (d.proactiveOutputs.length > 0) {
    lines.push("", "SURFACE BEFORE THEY ASK:");
    for (const o of d.proactiveOutputs) lines.push(`- ${o}`);
  }

  return lines.join("\n");
}
