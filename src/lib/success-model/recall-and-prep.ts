import type { CanonicalCareEvent } from "../situation-entry/types";
import { runRetrievalOnlyGeneration } from "../trust-provenance";
import { buildMetricScore } from "./scoring";
import type { MetricScore, RecallProbe } from "./types";

export function measureMeetingPreparationEfficiency(input: {
  topEventIds: string[];
  attentionEventIds: string[];
  unresolvedQuestions: string[];
  openFollowUps: number;
  totalRelevantEvents: number;
}): MetricScore {
  const signals: string[] = [];
  let score = 25;

  if (input.topEventIds.length >= 3) {
    score += 25;
    signals.push(`${input.topEventIds.length} priority events auto-surfaced`);
  } else if (input.topEventIds.length >= 1) {
    score += 15;
    signals.push("Key events surfaced for preparation");
  }

  if (input.attentionEventIds.length > 0) {
    score += 15;
    signals.push(`${input.attentionEventIds.length} attention item(s) flagged`);
  }

  if (input.unresolvedQuestions.length > 0) {
    score += 20;
    signals.push(`${input.unresolvedQuestions.length} outstanding question(s) identified`);
  }

  if (input.openFollowUps > 0) {
    score += 10;
    signals.push(`${input.openFollowUps} open follow-up(s) visible before meetings`);
  }

  if (input.totalRelevantEvents >= 5) {
    score += 5;
    signals.push("Rich event context available for meeting prep");
  }

  return buildMetricScore("meeting_preparation_efficiency", score, signals);
}

export function measureFollowUpReliability(input: {
  openFollowUps: number;
  closedFollowUps: number;
  attentionEvents: number;
  overdueSurfaced: number;
}): MetricScore {
  const signals: string[] = [];
  const total = input.openFollowUps + input.closedFollowUps;
  let score = 30;

  if (total > 0) {
    const completionRate = input.closedFollowUps / total;
    score += completionRate * 40;
    signals.push(`${Math.round(completionRate * 100)}% follow-ups completed`);
  }

  if (input.attentionEvents > 0) {
    score += 15;
    signals.push(`${input.attentionEvents} obligation(s) flagged for attention`);
  }

  if (input.overdueSurfaced > 0) {
    score += 10;
    signals.push(`${input.overdueSurfaced} overdue item(s) surfaced automatically`);
  }

  if (input.openFollowUps === 0 && total > 0) {
    score += 15;
    signals.push("No open follow-ups — obligations tracked");
  }

  return buildMetricScore("follow_up_reliability", score, signals);
}

const RECALL_PROBE_QUESTIONS = [
  "What has changed recently?",
  "What follow-ups are still open?",
  "What remains unresolved?",
];

export function runRecallProbes(
  events: CanonicalCareEvent[],
  unresolvedQuestions: string[],
): RecallProbe[] {
  return RECALL_PROBE_QUESTIONS.map((question) => {
    const result = runRetrievalOnlyGeneration({
      events,
      dare: null,
      unresolved_questions: unresolvedQuestions,
      question,
    });

    return {
      question,
      answered: result.may_generate,
      answer: result.response,
      evidence_event_ids: result.retrieval_context.care_event_ids.slice(0, 5),
      from_continuity: result.may_generate && result.evidence.length > 0,
    };
  });
}

export function measureRecallAccuracy(probes: RecallProbe[]): MetricScore {
  const signals: string[] = [];
  const answered = probes.filter((p) => p.answered && p.from_continuity);
  const score = probes.length > 0 ? (answered.length / probes.length) * 100 : 0;

  if (answered.length > 0) {
    signals.push(`${answered.length}/${probes.length} questions answered from Care Context`);
  }

  for (const probe of probes.filter((p) => p.from_continuity)) {
    signals.push(`"${probe.question}" — answered from continuity`);
  }

  for (const probe of probes.filter((p) => !p.answered)) {
    signals.push(`"${probe.question}" — insufficient evidence (honest deferral)`);
  }

  return buildMetricScore("recall_accuracy", score, signals);
}
