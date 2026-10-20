import type { CareContext } from "../care-context/types";
import type {
  ChangeRecognitionLatencyMetric,
  ClarificationLoadMetric,
  CognitiveLoadReductionMetric,
  DecisionSupportImpactMetric,
  OMLSession,
  OMLState,
  OutcomeMetricsSnapshot,
  TimelineReconstructionAccuracyMetric,
  TimeToUnderstandingMetric,
  CaregiverCognitiveLoadScoreMetric,
} from "./types";
import { deriveClarifications } from "../care-context/engines/clarification-engine";
import { detectContradictions } from "../care-context/engines/contradiction-detection";
import { computeDiff } from "../care-context/engines/diff-engine";

const CONFUSION_PATTERN =
  /\b(confus(?:ed|ing)|unsure|don't understand|mixed up|lost|unclear)\b/i;
const WHAT_CHANGED_PATTERN = /\b(what changed|what's different|getting worse)\b/i;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export function computeCognitiveLoadReduction(
  sessions: OMLSession[],
): CognitiveLoadReductionMetric {
  const recent = sessions.slice(-10);
  const questionsPerSession =
    recent.length > 0
      ? recent.reduce((s, sess) => s + sess.questionsAsked.length, 0) /
        recent.length
      : 0;

  const whatChangedQueries = recent.reduce(
    (s, sess) => s + sess.whatChangedQueries,
    0,
  );
  const repeatedInputs = recent.reduce((s, sess) => s + sess.repeatedInputs, 0);
  const reviewTimeSeconds = recent.reduce(
    (s, sess) => s + sess.reviewTimeSeconds,
    0,
  );
  const confusionSignals = recent.reduce(
    (s, sess) => s + sess.confusionSignals,
    0,
  );

  const raw =
    questionsPerSession * 15 +
    whatChangedQueries * 10 +
    repeatedInputs * 12 +
    Math.min(reviewTimeSeconds / 10, 20) +
    confusionSignals * 8;

  return {
    id: "cognitive_load_reduction",
    questionsPerSession: Math.round(questionsPerSession * 10) / 10,
    whatChangedQueries,
    repeatedInputs,
    reviewTimeSeconds,
    confusionSignals,
    score: Math.min(Math.round(raw), 100),
  };
}

export function computeTimeToUnderstanding(
  sessions: OMLSession[],
): TimeToUnderstandingMetric {
  const withClarity = sessions.filter((s) => s.clarityAchievedAt);
  const ttuValues = withClarity.map((s) => {
    const start = new Date(s.openedAt).getTime();
    const end = new Date(s.clarityAchievedAt!).getTime();
    return (end - start) / 1000;
  });

  const interactions = withClarity.map((s) => s.interactions);

  return {
    id: "time_to_understanding",
    medianSecondsToClarity: median(ttuValues),
    interactionsBeforeClarity: median(interactions),
    sessionsMeasured: withClarity.length,
  };
}

export function computeChangeRecognitionLatency(
  context: CareContext,
): ChangeRecognitionLatencyMetric {
  const diff = computeDiff(context);
  const latencies: number[] = [];

  for (const change of diff.changes) {
    for (const evidence of change.evidence) {
      const event = context.timeline.find((e) => e.description === evidence);
      if (event) {
        const eventTime = new Date(event.recordedAt).getTime();
        const detectedTime = new Date(change.detectedAt).getTime();
        latencies.push(Math.max(0, detectedTime - eventTime));
      }
    }
  }

  const surfaced = context.recentChanges.length;
  const pending = Math.max(
    0,
    context.timeline.length - surfaced - diff.changes.length,
  );

  return {
    id: "change_recognition_latency",
    medianLatencyMs: median(latencies),
    eventsMeasured: latencies.length,
    pendingRecognition: pending,
  };
}

export function computeClarificationLoad(
  context: CareContext,
  omlState: OMLState,
): ClarificationLoadMetric {
  const clarifications = omlState.clarifications;
  const needed = deriveClarifications(context);
  const eventCount = Math.max(context.timeline.length, 1);

  const unresolved = clarifications.filter((c) => !c.resolved).length;
  const total = Math.max(clarifications.length, needed.length);
  const repeated = clarifications.filter((c) => c.repeated).length;

  const questionsPerCareEvent =
    Math.round((clarifications.length / eventCount) * 100) / 100;
  const unresolvedClarificationRatio =
    total > 0 ? Math.round((unresolved / total) * 100) / 100 : 0;

  const score = Math.min(
    Math.round(
      questionsPerCareEvent * 20 +
        unresolvedClarificationRatio * 40 +
        repeated * 15,
    ),
    100,
  );

  return {
    id: "clarification_load",
    questionsPerCareEvent,
    unresolvedClarificationRatio,
    repeatedClarificationRequests: repeated,
    score,
  };
}

export function computeTimelineReconstructionAccuracy(
  context: CareContext,
  omlState: OMLState,
): TimelineReconstructionAccuracyMetric {
  const corrections = omlState.timelineCorrections.length;
  const reordering = omlState.timelineCorrections.filter(
    (c) => c.correctionType === "reorder",
  ).length;
  const contradictions = detectContradictions(context);
  const resolutions = omlState.timelineCorrections.filter(
    (c) => c.correctionType === "description_fix",
  ).length;

  const penalty = corrections * 8 + contradictions.length * 10;
  const accuracyScore = Math.max(0, Math.min(100, 100 - penalty));

  return {
    id: "timeline_reconstruction_accuracy",
    accuracyScore,
    caregiverCorrections: corrections,
    eventReorderingFeedback: reordering,
    contradictionResolutions: resolutions,
  };
}

export function computeCaregiverCognitiveLoadScore(
  context: CareContext,
  clarificationLoad: ClarificationLoadMetric,
): CaregiverCognitiveLoadScoreMetric {
  const uncertaintyDensity =
    context.uncertainties.length / Math.max(context.timeline.length, 1);
  const openLoops =
    context.prioritizedActions.filter(
      (a) => a.urgency === "now" || a.urgency === "soon",
    ).length + context.uncertainties.length;
  const unresolvedCareEvents = context.timeline.filter(
    (e) => e.source === "question",
  ).length;
  const contradictionFrequency = detectContradictions(context).length;
  const clarificationBurden = clarificationLoad.score;

  const score = Math.min(
    Math.round(
      uncertaintyDensity * 25 +
        openLoops * 8 +
        unresolvedCareEvents * 6 +
        contradictionFrequency * 12 +
        clarificationBurden * 0.3,
    ),
    100,
  );

  let level: CaregiverCognitiveLoadScoreMetric["level"];
  if (score >= 70) level = "critical";
  else if (score >= 45) level = "high";
  else if (score >= 20) level = "moderate";
  else level = "low";

  return {
    id: "caregiver_cognitive_load_score",
    score,
    level,
    components: {
      uncertaintyDensity: Math.round(uncertaintyDensity * 100) / 100,
      openLoops,
      unresolvedCareEvents,
      contradictionFrequency,
      clarificationBurden,
    },
  };
}

export function computeDecisionSupportImpact(
  omlState: OMLState,
): DecisionSupportImpactMetric {
  const escalationFollowed = omlState.decisionSignals.filter(
    (s) => s.type === "escalation_followed",
  ).length;
  const unnecessaryDecisionDelayed = omlState.decisionSignals.filter(
    (s) => s.type === "decision_delayed",
  ).length;
  const noActionConfirmed = omlState.decisionSignals.filter(
    (s) => s.type === "no_action_confirmed",
  ).length;
  const total = omlState.decisionSignals.length;

  const impactScore =
    total > 0
      ? Math.min(
          Math.round(
            ((escalationFollowed + unnecessaryDecisionDelayed + noActionConfirmed) /
              total) *
              100,
          ),
          100,
        )
      : 0;

  return {
    id: "decision_support_impact",
    escalationFollowed,
    unnecessaryDecisionDelayed,
    noActionConfirmed,
    totalDecisionSignals: total,
    impactScore,
  };
}

export function computeOutcomeSnapshot(
  context: CareContext,
  omlState: OMLState,
): OutcomeMetricsSnapshot {
  const clarificationLoad = computeClarificationLoad(context, omlState);

  return {
    cognitiveLoadReduction: computeCognitiveLoadReduction(omlState.sessions),
    timeToUnderstanding: computeTimeToUnderstanding(omlState.sessions),
    changeRecognitionLatency: computeChangeRecognitionLatency(context),
    clarificationLoad,
    timelineReconstructionAccuracy: computeTimelineReconstructionAccuracy(
      context,
      omlState,
    ),
    caregiverCognitiveLoadScore: computeCaregiverCognitiveLoadScore(
      context,
      clarificationLoad,
    ),
    decisionSupportImpact: computeDecisionSupportImpact(omlState),
    assessedAt: new Date().toISOString(),
  };
}

/** Detect confusion/what-changed signals in session questions. */
export function classifySessionQuestion(question: string): {
  isWhatChanged: boolean;
  isConfusion: boolean;
} {
  return {
    isWhatChanged: WHAT_CHANGED_PATTERN.test(question),
    isConfusion: CONFUSION_PATTERN.test(question),
  };
}
