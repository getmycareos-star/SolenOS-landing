import type { ReliefOutcome } from "./contract-constants";
import type { ReliefSignalSnapshot } from "./signals";

/** Classify relief from observable proxy signals — never assumes success. */
export function classifyReliefOutcome(signals: ReliefSignalSnapshot): ReliefOutcome {
  const negativeFeedback =
    signals.helpful_feedback === false || signals.reduced_confusion === false;

  if (
    negativeFeedback &&
    (signals.requery_detected || signals.clarification_detected || signals.reduced_confusion === false)
  ) {
    return "failure";
  }

  if (signals.helpful_feedback === false) {
    return "failure";
  }

  if (signals.requery_detected && signals.clarification_detected) {
    return "failure";
  }

  if (signals.clarification_detected || signals.requery_detected) {
    if (signals.helpful_feedback === true || signals.reduced_confusion === true) {
      return "partial";
    }
    return signals.requery_detected ? "failure" : "partial";
  }

  if (signals.helpful_feedback === true) {
    if (signals.reduced_confusion === false) {
      return "partial";
    }
    return "high";
  }

  if (signals.reduced_confusion === true) {
    return "high";
  }

  if (signals.reduced_confusion === false) {
    return "none";
  }

  return "none";
}

export function classifyReliefOutcomeAfterFeedback(
  signals: ReliefSignalSnapshot,
): ReliefOutcome {
  return classifyReliefOutcome(signals);
}

export function classifyReliefOutcomeAtAnalyze(signals: ReliefSignalSnapshot): ReliefOutcome {
  if (signals.requery_detected && signals.clarification_detected) {
    return "failure";
  }
  if (signals.requery_detected) {
    return "partial";
  }
  if (signals.clarification_detected) {
    return "partial";
  }
  return "none";
}
