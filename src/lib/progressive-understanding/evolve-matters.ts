import type { ActiveCareSituation, UnderstandingStage } from "../active-care-situation/types";
import type { ObservationSignal } from "./types";
import { emotionalSignalCount } from "./detect-signals";

/**
 * Evolve what matters now — do not regenerate from scratch without prior context.
 * Never topic keyword urgency (fall/med/appetite). Clarity pillars own caregiver copy.
 */
export function evolveWhatMattersNow(params: {
  prior: ActiveCareSituation | null;
  stage: UnderstandingStage;
  signals: readonly ObservationSignal[];
  latestSignals?: readonly ObservationSignal[];
  patternLabel: string | null;
  theme: ActiveCareSituation["theme"];
}): string | null {
  const { prior, stage, signals, patternLabel, theme } = params;
  const priorMatters = prior?.what_matters_now ?? null;

  if (stage === "gathering") {
    return priorMatters;
  }

  if (stage === "forming") {
    if (emotionalSignalCount(signals) >= 2 || patternLabel) {
      const next =
        "What matters now: notice whether today's changes keep shifting together. What can wait: organizing a full timeline — add only what you already know.";
      return priorMatters && priorMatters !== next
        ? `${next} (Updated as related observations connected.)`
        : next;
    }
    return (
      priorMatters ??
      "What matters now: keep related parts of the care story together. What can wait: perfect wording or a complete history."
    );
  }

  if (patternLabel || theme === "emotional_behavior") {
    const next =
      "What matters now: whether this pattern is new or returning, and what has helped before. What can wait: explaining every detail — a short follow-up question is enough.";
    if (priorMatters && /Monitor behavioural|no immediate|Keep adding/i.test(priorMatters)) {
      return next;
    }
    return next;
  }

  return (
    priorMatters ??
    "What matters now: when this happens and what came just before. What can wait: filling every gap today."
  );
}
