import type { EngineMetricDeclaration, OutcomeMetricId } from "./types";

/**
 * Each engine MUST declare what metric it improves.
 * If an engine cannot map to a measurable outcome, it is not valid in MVP architecture.
 */
export const ENGINE_METRIC_MAP: EngineMetricDeclaration[] = [
  {
    engine: "diff_engine",
    improvesMetrics: ["change_recognition_latency", "cognitive_load_reduction"],
    module: "care-context/engines/diff-engine.ts",
  },
  {
    engine: "timeline_reconstruction",
    improvesMetrics: [
      "timeline_reconstruction_accuracy",
      "cognitive_load_reduction",
    ],
    module: "care-context/engines/timeline-engine.ts",
  },
  {
    engine: "clarification_engine",
    improvesMetrics: ["clarification_load", "caregiver_cognitive_load_score"],
    module: "care-context/engines/clarification-engine.ts",
  },
  {
    engine: "caregiver_load_engine",
    improvesMetrics: [
      "caregiver_cognitive_load_score",
      "cognitive_load_reduction",
    ],
    module: "care-context/engines/caregiver-load-engine.ts",
  },
  {
    engine: "state_of_care",
    improvesMetrics: [
      "time_to_understanding",
      "decision_support_impact",
      "cognitive_load_reduction",
    ],
    module: "care-context/engines/state-of-care-engine.ts",
  },
  {
    engine: "prioritization_engine",
    improvesMetrics: [
      "decision_support_impact",
      "caregiver_cognitive_load_score",
    ],
    module: "care-context/continuity-engine.ts",
  },
  {
    engine: "trust_layer",
    improvesMetrics: ["time_to_understanding", "decision_support_impact"],
    module: "care-context/engines/trust-layer.ts",
  },
  {
    engine: "pattern_learning_engine",
    improvesMetrics: ["change_recognition_latency", "timeline_reconstruction_accuracy"],
    module: "care-context/engines/pattern-learning-engine.ts",
  },
  {
    engine: "contradiction_detection",
    improvesMetrics: ["timeline_reconstruction_accuracy", "clarification_load"],
    module: "care-context/engines/contradiction-detection.ts",
  },
  {
    engine: "attention_budget",
    improvesMetrics: ["caregiver_cognitive_load_score", "cognitive_load_reduction"],
    module: "care-context/engines/attention-budget.ts",
  },
  {
    engine: "opening_surface",
    improvesMetrics: ["time_to_understanding", "cognitive_load_reduction"],
    module: "care-context/opening-surface.ts",
  },
  {
    engine: "clinical_summary_generator",
    improvesMetrics: ["decision_support_impact", "timeline_reconstruction_accuracy"],
    module: "care-snapshot/build-snapshot.ts",
  },
];

export function metricsForEngine(engine: string): OutcomeMetricId[] {
  return (
    ENGINE_METRIC_MAP.find((e) => e.engine === engine)?.improvesMetrics ?? []
  );
}

export function enginesForMetric(metricId: OutcomeMetricId): string[] {
  return ENGINE_METRIC_MAP.filter((e) =>
    e.improvesMetrics.includes(metricId),
  ).map((e) => e.engine);
}

export function validateEngineHasMetrics(engine: string): boolean {
  return metricsForEngine(engine).length > 0;
}
