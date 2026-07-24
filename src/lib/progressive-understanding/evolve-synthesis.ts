import type { ActiveCareSituation, UnderstandingStage } from "../active-care-situation/types";
import { observationCareFact } from "../care-epistemics";
import { extractCareRealityFromText } from "../care-reality-extraction";
import { isNearRawCaregiverFacet } from "../output-quality";
import {
  emotionalSignalCount,
  isImprovementUpdate,
  patternLabelFor,
} from "./detect-signals";
import type { ObservationSignal } from "./types";
import { isCaregiverFacingFactLine } from "./clarity-pillars";

/** Build evolving understanding lines — latest state first. */
export function buildEvolvingUnderstandingLines(
  situation: ActiveCareSituation,
): string[] {
  const obs = situation.observations;
  if (obs.length === 0) return [];

  const lines: string[] = [];
  const seen = new Set<string>();

  const push = (raw: string, prefix?: string) => {
    const fact = raw.trim();
    if (!fact || !isCaregiverFacingFactLine(fact)) return;
    const normalized = fact.endsWith(".") ? fact : `${fact}.`;
    const key = normalized.toLowerCase().replace(/^earlier:\s*/i, "");
    if (seen.has(key)) return;
    seen.add(key);
    lines.push(prefix ? `${prefix}${normalized}` : normalized);
  };

  const latest = obs[obs.length - 1]!;
  const latestFact =
    observationCareFact({
      human_fact: latest.human_fact,
      raw_text: latest.raw_text,
    }) ??
    (isCaregiverFacingFactLine(latest.human_fact || latest.raw_text)
      ? (latest.human_fact || latest.raw_text).trim()
      : null);
  if (latestFact) push(latestFact);

  const priorFacts: string[] = latestFact ? [latestFact] : [];
  for (const o of [...obs.slice(0, -1)].reverse()) {
    if (lines.length >= 3) break;
    const fact =
      observationCareFact({
        human_fact: o.human_fact,
        raw_text: o.raw_text,
        priorFacts,
      }) ??
      (isCaregiverFacingFactLine(o.human_fact || o.raw_text)
        ? (o.human_fact || o.raw_text).trim()
        : null);
    if (fact) {
      push(fact, "Earlier: ");
      priorFacts.push(fact);
    }
  }

  return lines;
}

export function stageFromSignals(
  observationCount: number,
  signals: readonly ObservationSignal[],
): UnderstandingStage {
  const emotional = emotionalSignalCount(signals);
  const pattern = patternLabelFor(signals);
  if (observationCount >= 3 || (pattern && observationCount >= 2 && emotional >= 2)) {
    return "synthesizing";
  }
  if (observationCount >= 2 || emotional >= 2) return "forming";
  return "gathering";
}

function clipUnderstandingSpan(text: string, max = 110): string {
  return text.replace(/\s+/g, " ").trim().replace(/\.$/, "").slice(0, max);
}

/**
 * Plain Living Care Record summary — never AI analysis voice, never notes-app chrome.
 */
export function evolveSynthesis(params: {
  situation: ActiveCareSituation;
  stage: UnderstandingStage;
  signals: readonly ObservationSignal[];
  latestSignals: readonly ObservationSignal[];
  patternLabel: string | null;
}): string | null {
  const { situation, stage, signals, latestSignals } = params;
  void signals;
  if (stage === "gathering" && !isImprovementUpdate(latestSignals)) return null;

  if (isImprovementUpdate(latestSignals)) {
    const latest =
      situation.observations[situation.observations.length - 1]?.human_fact?.trim() ||
      situation.observations[situation.observations.length - 1]?.raw_text?.trim();
    if (latest) {
      return `${latest.replace(/\.$/, "")} — held as the latest picture.`;
    }
    return "The latest update changes what we understand. Earlier understanding stays in the care story.";
  }

  if (stage === "gathering") return null;

  // Orient from held facts — never phrase if-branches (frustrated+sad+go home scripts).
  const held = situation.observations
    .map((o) => o.human_fact.trim())
    .filter(Boolean)
    .slice(-2);
  if (held.length >= 2) {
    return `${held.join(" ")} Held as one care situation.`;
  }
  if (held.length === 1) {
    return `${held[0]!.replace(/\.$/, "")} — held with the care situation underway.`;
  }
  return null;
}

/**
 * Understanding delta from extraction — new observation / related event / after-visit outcome.
 * Never notes-app chrome (“related note”, “today’s notes”).
 */
export function evolveUnderstandingDelta(params: {
  prior: ActiveCareSituation | null;
  stage: UnderstandingStage;
  signals: readonly ObservationSignal[];
  priorSignals: readonly ObservationSignal[];
  patternLabel: string | null;
  resolvedCount: number;
  effectLabel: string;
  latestSignals?: readonly ObservationSignal[];
  /** Latest capture text — preferred source for extraction-derived deltas. */
  latestRawText?: string;
}): string | null {
  const {
    prior,
    signals,
    priorSignals,
    latestSignals = [],
    latestRawText,
  } = params;
  if (!prior || prior.observations.length === 0) {
    return null;
  }

  if (isImprovementUpdate(latestSignals)) {
    return "The latest update changes what we understand. Earlier understanding stays in the care story.";
  }

  const latestText =
    latestRawText?.trim() ||
    // Fall back to newest observation on the situation when caller omits raw text.
    "";
  if (latestText) {
    const extraction = extractCareRealityFromText({ rawText: latestText });
    const outcome = extraction.outcomes[0];
    if (outcome?.description) {
      const desc = clipUnderstandingSpan(outcome.description);
      if (isNearRawCaregiverFacet(desc, latestText)) {
        return "After what was already underway — held as what followed.";
      }
      return `After what was already underway: ${desc} — held as what followed.`;
    }
    const event = extraction.events[0];
    if (event?.description) {
      const desc = clipUnderstandingSpan(event.description);
      if (isNearRawCaregiverFacet(desc, latestText)) {
        return "A related care update is held with the situation underway.";
      }
      return `A related care update is held with the situation underway: ${desc}.`;
    }
    const observation = extraction.observations[0];
    if (observation?.description) {
      const desc = clipUnderstandingSpan(observation.description);
      if (isNearRawCaregiverFacet(desc, latestText)) {
        return "A new observation is held with the care situation underway.";
      }
      return `A new observation is held with the care situation underway: ${desc}.`;
    }
    if (extraction.decisions[0]?.description) {
      const desc = clipUnderstandingSpan(extraction.decisions[0].description);
      if (isNearRawCaregiverFacet(desc, latestText)) {
        return "A care choice is held with the situation underway.";
      }
      return `A care choice is held with the situation underway: ${desc}.`;
    }
  }

  const newSignals = signals.filter((s) => !priorSignals.includes(s) && s !== "general");
  if (newSignals.length > 0) {
    return "A new observation is held with the care situation underway.";
  }
  return "Understanding of the care situation was updated.";
}
