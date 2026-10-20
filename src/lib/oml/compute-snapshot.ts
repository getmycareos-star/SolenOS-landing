import type {
  OutcomeMeasurementResult,
  OutcomeMetricDelta,
  OutcomeMetricsSnapshot,
  OutcomeTrend,
} from "./types";

/** Metrics where lower values indicate improvement. */
const LOWER_IS_BETTER = new Set([
  "cognitive_load_reduction",
  "time_to_understanding",
  "change_recognition_latency",
  "clarification_load",
  "caregiver_cognitive_load_score",
]);

function extractScalar(snapshot: OutcomeMetricsSnapshot, id: string): number {
  switch (id) {
    case "cognitive_load_reduction":
      return snapshot.cognitiveLoadReduction.score;
    case "time_to_understanding":
      return snapshot.timeToUnderstanding.medianSecondsToClarity ?? 100;
    case "change_recognition_latency":
      return snapshot.changeRecognitionLatency.medianLatencyMs ?? 10000;
    case "clarification_load":
      return snapshot.clarificationLoad.score;
    case "timeline_reconstruction_accuracy":
      return snapshot.timelineReconstructionAccuracy.accuracyScore;
    case "caregiver_cognitive_load_score":
      return snapshot.caregiverCognitiveLoadScore.score;
    case "decision_support_impact":
      return snapshot.decisionSupportImpact.impactScore;
    default:
      return 0;
  }
}

export function computeMetricDeltas(
  previous: OutcomeMetricsSnapshot | null,
  current: OutcomeMetricsSnapshot,
): OutcomeMetricDelta[] {
  if (!previous) return [];

  const ids = [
    "cognitive_load_reduction",
    "time_to_understanding",
    "change_recognition_latency",
    "clarification_load",
    "timeline_reconstruction_accuracy",
    "caregiver_cognitive_load_score",
    "decision_support_impact",
  ] as const;

  return ids.map((metricId) => {
    const prevVal = extractScalar(previous, metricId);
    const currVal = extractScalar(current, metricId);
    const change = currVal - prevVal;
    const lowerBetter = LOWER_IS_BETTER.has(metricId);

    let direction: OutcomeMetricDelta["direction"];
    if (Math.abs(change) < 0.01) direction = "unchanged";
    else if (lowerBetter ? change < 0 : change > 0) direction = "better";
    else direction = "worse";

    return {
      metricId,
      previousValue: prevVal,
      currentValue: currVal,
      change: Math.round(change * 100) / 100,
      direction,
    };
  });
}

export function computeOutcomeTrend(
  deltas: OutcomeMetricDelta[],
): OutcomeTrend {
  if (deltas.length === 0) return "stable";

  const better = deltas.filter((d) => d.direction === "better").length;
  const worse = deltas.filter((d) => d.direction === "worse").length;

  if (better > worse + 1) return "improving";
  if (worse > better + 1) return "worsening";
  return "stable";
}

export function buildOutcomeMeasurement(
  snapshot: OutcomeMetricsSnapshot,
  previous: OutcomeMetricsSnapshot | null,
): OutcomeMeasurementResult {
  const deltas = computeMetricDeltas(previous, snapshot);
  const trend = computeOutcomeTrend(deltas);

  const ccl = snapshot.caregiverCognitiveLoadScore;
  const clr = snapshot.cognitiveLoadReduction;

  const systemWorking =
    trend !== "worsening" &&
    ccl.level !== "critical" &&
    clr.score < 60;

  let summary: string;
  if (systemWorking && trend === "improving") {
    summary =
      "SolenOS is measurably reducing caregiver uncertainty and cognitive load.";
  } else if (systemWorking) {
    summary = "SolenOS is maintaining acceptable outcome levels.";
  } else if (ccl.level === "critical") {
    summary =
      "System failing — caregiver cognitive load is critical. Prioritize continuity gaps.";
  } else {
    summary =
      "Outcome trend worsening — review engine effectiveness and CareContext completeness.";
  }

  return { snapshot, deltas, trend, systemWorking, summary };
}

export function formatOutcomeMeasurement(
  result: OutcomeMeasurementResult,
): string {
  const lines = [
    "OUTCOME MEASUREMENT LAYER",
    "",
    `Trend: ${result.trend}`,
    `System working: ${result.systemWorking ? "yes" : "no"}`,
    result.summary,
    "",
    "CORE METRICS:",
    `- Cognitive Load Reduction: ${result.snapshot.cognitiveLoadReduction.score}/100 (lower better)`,
    `- Time-to-Understanding: ${result.snapshot.timeToUnderstanding.medianSecondsToClarity ?? "N/A"}s median`,
    `- Change Recognition Latency: ${result.snapshot.changeRecognitionLatency.medianLatencyMs ?? "N/A"}ms median`,
    `- Clarification Load: ${result.snapshot.clarificationLoad.score}/100 (lower better)`,
    `- Timeline Accuracy: ${result.snapshot.timelineReconstructionAccuracy.accuracyScore}/100 (higher better)`,
    `- Caregiver Cognitive Load (CCL): ${result.snapshot.caregiverCognitiveLoadScore.score}/100 [${result.snapshot.caregiverCognitiveLoadScore.level}]`,
    `- Decision Support Impact: ${result.snapshot.decisionSupportImpact.impactScore}/100`,
  ];

  if (result.deltas.length > 0) {
    lines.push("", "DELTAS:");
    for (const d of result.deltas) {
      lines.push(
        `- ${d.metricId}: ${d.previousValue} → ${d.currentValue} (${d.direction})`,
      );
    }
  }

  return lines.join("\n");
}
