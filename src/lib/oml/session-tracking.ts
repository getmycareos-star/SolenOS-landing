import type { OMLSession } from "./types";
import { classifySessionQuestion } from "./compute-metrics";

let sessionCounter = 0;

export function createOMLSession(): OMLSession {
  sessionCounter += 1;
  return {
    sessionId: `oml_sess_${sessionCounter}_${Date.now()}`,
    openedAt: new Date().toISOString(),
    questionsAsked: [],
    whatChangedQueries: 0,
    repeatedInputs: 0,
    reviewTimeSeconds: 0,
    interactions: 0,
    confusionSignals: 0,
  };
}

export function recordSessionQuestion(
  session: OMLSession,
  question: string,
  priorQuestions: string[] = [],
): OMLSession {
  const normalized = question.toLowerCase().trim();
  const isRepeat = priorQuestions.some(
    (q) => q.toLowerCase().trim() === normalized,
  );
  const { isWhatChanged, isConfusion } = classifySessionQuestion(question);

  return {
    ...session,
    questionsAsked: [...session.questionsAsked, question],
    whatChangedQueries: session.whatChangedQueries + (isWhatChanged ? 1 : 0),
    repeatedInputs: session.repeatedInputs + (isRepeat ? 1 : 0),
    confusionSignals: session.confusionSignals + (isConfusion ? 1 : 0),
    interactions: session.interactions + 1,
  };
}

export function recordSessionInteraction(session: OMLSession): OMLSession {
  return { ...session, interactions: session.interactions + 1 };
}

export function recordReviewTime(
  session: OMLSession,
  additionalSeconds: number,
): OMLSession {
  return {
    ...session,
    reviewTimeSeconds: session.reviewTimeSeconds + additionalSeconds,
  };
}

/** Caregiver viewed State of Care and achieved clarity. */
export function recordClarityAchieved(session: OMLSession): OMLSession {
  return {
    ...session,
    clarityAchievedAt: new Date().toISOString(),
    interactions: session.interactions + 1,
  };
}

export function closeSession(session: OMLSession): OMLSession {
  return { ...session, closedAt: new Date().toISOString() };
}
