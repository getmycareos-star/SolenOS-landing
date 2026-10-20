import type {
  CaregiverFailureCategory,
  FeatureEvaluation,
  FailureFirstDiagnosis,
} from "./failure-model-types";
import type { CareContext } from "./types";
import {
  enginesForFailure,
  failureDefinition,
  primaryFailureMapping,
} from "./failure-engine-map";
import { buildOpeningSurface } from "./opening-surface";
import { planProactiveSurface } from "./proactive-surface";
import { HIRE_HELP_IMPLIED_CONTEXT } from "./question-capability-map";

function impliedMissingContext(
  question: string,
  context: CareContext,
): string[] {
  const lower = question.toLowerCase();
  if (!/\b(hir(?:e|ing)|professional help|professional care)\b/i.test(lower)) {
    return [];
  }
  return HIRE_HELP_IMPLIED_CONTEXT.filter((label) => {
    const keyword = label.split(" ").pop()!.toLowerCase().replace(/ing$/, "");
    return !context.timeline.some((e) =>
      e.description.toLowerCase().includes(keyword),
    );
  });
}

/**
 * Failure-first classification — ask what failed BEFORE thinking about features.
 */
export function classifyCaregiverFailure(
  question: string,
  context?: CareContext,
): FailureFirstDiagnosis {
  const mapping = primaryFailureMapping(question);

  const fallbackCategory: CaregiverFailureCategory = "memory_reconstruction_failure";
  const category = mapping?.failureCategory ?? fallbackCategory;
  const def = failureDefinition(category);
  const continuityCanEliminate = mapping?.continuityCanEliminate ?? def?.continuityCanEliminate ?? true;

  const productResponse = [
    ...new Set([
      ...(mapping?.productResponse ?? []),
      ...enginesForFailure(category),
    ]),
  ];

  const proactive = context ? planProactiveSurface(context) : null;
  const openingSurface = context
    ? buildOpeningSurface(context)
    : {
        whatChanged: [],
        whatIsStable: [],
        whatNeedsAttention: [],
        whatIsUncertain: [],
        whatShouldHappenNext: [],
      };

  return {
    question: question.trim(),
    notAbout: mapping?.notAbout ?? "An isolated answer — it is evidence of a system failure.",
    failureCategory: category,
    failureLabel: mapping?.failureLabel ?? def?.label ?? "Unknown failure",
    failureDescription: def?.description ?? "Care system failed to maintain continuity.",
    productResponse,
    continuityCanEliminate,
    productScope: continuityCanEliminate ? "core" : "educational_content",
    doNotBuild: continuityCanEliminate
      ? "A chatbot answer or longer AI explanation"
      : "A core product feature — route to educational content",
    impliedMissingContext: context ? impliedMissingContext(question, context) : [],
    canSurfaceProactively: proactive ? proactive.items.length > 0 : false,
    openingSurface,
  };
}

export function formatFailureFirstDiagnosis(d: FailureFirstDiagnosis): string {
  const lines = [
    "FAILURE-FIRST DIAGNOSIS",
    "",
    `Question: ${d.question}`,
    `NOT about: ${d.notAbout}`,
    "",
    `FAILURE: ${d.failureLabel}`,
    `Category: ${d.failureCategory}`,
    d.failureDescription,
    "",
    `Product scope: ${d.productScope}`,
    `Continuity can eliminate: ${d.continuityCanEliminate ? "yes" : "no → educational content"}`,
    "",
    "DO NOT BUILD:",
    `- ${d.doNotBuild}`,
    "",
    "PRODUCT RESPONSE (engines/surfaces):",
    ...d.productResponse.map((e) => `- ${e}`),
  ];

  if (d.impliedMissingContext.length > 0) {
    lines.push("", "DISCONNECTED CONTEXT:");
    for (const c of d.impliedMissingContext) lines.push(`- ${c}`);
  }

  lines.push(
    "",
    `Proactive surfacing: ${d.canSurfaceProactively ? "yes" : "no"}`,
  );

  return lines.join("\n");
}

/**
 * Feature evaluation rule — before building any feature, ask:
 * Which failure does it solve? Does it reduce uncertainty/load/reconstruction/questions?
 */
export function evaluateFeature(
  featureName: string,
  opts: {
    failureSolved?: CaregiverFailureCategory;
    reducesUncertainty?: boolean;
    reducesCognitiveLoad?: boolean;
    reducesReconstruction?: boolean;
    reducesQuestions?: boolean;
  },
): FeatureEvaluation {
  const {
    failureSolved = null,
    reducesUncertainty = false,
    reducesCognitiveLoad = false,
    reducesReconstruction = false,
    reducesQuestions = false,
  } = opts;

  const scores = [
    reducesUncertainty,
    reducesCognitiveLoad,
    reducesReconstruction,
    reducesQuestions,
  ];
  const passCount = scores.filter(Boolean).length;
  const inCoreMission = failureSolved !== null && passCount >= 2;

  let verdict: FeatureEvaluation["verdict"];
  let reason: string;

  if (failureSolved === "information_not_eliminable_by_continuity") {
    verdict = "defer";
    reason = "Information demand — belongs in educational content, not core product.";
  } else if (!failureSolved) {
    verdict = "reject";
    reason = "No caregiver failure identified — outside SolenOS core mission.";
  } else if (inCoreMission) {
    verdict = "build";
    reason = `Eliminates ${failureSolved} and passes ${passCount}/4 impact criteria.`;
  } else {
    verdict = "defer";
    reason = `Addresses ${failureSolved} but insufficient impact on uncertainty, load, reconstruction, or question reduction.`;
  }

  return {
    featureName,
    failureSolved,
    reducesUncertainty,
    reducesCognitiveLoad,
    reducesReconstruction,
    reducesQuestions,
    inCoreMission,
    verdict,
    reason,
  };
}

export function formatFeatureEvaluation(e: FeatureEvaluation): string {
  return [
    `Feature: ${e.featureName}`,
    `Failure solved: ${e.failureSolved ?? "none"}`,
    `Reduces uncertainty: ${e.reducesUncertainty}`,
    `Reduces cognitive load: ${e.reducesCognitiveLoad}`,
    `Reduces reconstruction: ${e.reducesReconstruction}`,
    `Reduces questions: ${e.reducesQuestions}`,
    `Verdict: ${e.verdict.toUpperCase()} — ${e.reason}`,
  ].join("\n");
}
