import type { CareEventKind } from "../living-care-record-ux/event-clarifiers";
import type { ObservationSignal } from "./types";

/**
 * Positive wellbeing update — structural, not a phrase product rule.
 * Negated forms ("hasn't been feeling well") must never count as improvement.
 */
const WELLBEING_POSITIVE =
  /\b(?:feeling|feels?|doing|getting)\s+(?:well|better|good|happy)|(?:much|seems?|is|are)\s+better\b|\b(?:is|seems?|feeling)\s+happy\b|\bcalmer\b|\bcalmed\s+down\b|\bin\s+a\s+good\s+mood\b|\bback\s+to\s+normal\b|\bimprov(?:ed|ing)\b|\bate\s+(?:better|well)\b|\beating\s+better\b|\bmore\s+like\s+(?:her|him|them)self\b/i;

/** Negation / illness framing that blocks improvement on the same note. */
function hasNegatedOrUnwellFraming(text: string): boolean {
  // Normalize apostrophes so hasn't / hasnt share one path
  const t = text.toLowerCase().replace(/'/g, "");
  // not / n't … (within a short window) feeling|doing well|better
  if (
    /\b(hasnt|havent|hadnt|isnt|wasnt|arent|werent|dont|doesnt|didnt|aint|never|not)\b[\s\w,]{0,40}\b(feeling|doing|getting)\s+(well|better|good|happy)\b/.test(
      t,
    )
  ) {
    return true;
  }
  if (/\b(unwell|feeling\s+ill|feeling\s+sick|been\s+sick|been\s+ill)\b/.test(t)) {
    return true;
  }
  return false;
}

export function looksLikeImprovementNote(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (hasNegatedOrUnwellFraming(t)) return false;
  return WELLBEING_POSITIVE.test(t);
}

export function detectObservationSignals(
  text: string,
  kind: CareEventKind,
): ObservationSignal[] {
  const lower = text.toLowerCase();
  const signals: ObservationSignal[] = [];

  if (looksLikeImprovementNote(lower)) {
    signals.push("improvement");
  }

  if (/\bfrustrat/i.test(lower)) signals.push("frustration");
  if (/\bsad\b|upset|tear|cry/i.test(lower) && !signals.includes("improvement")) {
    signals.push("sadness");
  }
  if (/want(?:s|ed)? to go home|go home|homesick/i.test(lower)) signals.push("go_home");
  if (/\bconfus/i.test(lower) && !signals.includes("improvement")) signals.push("confusion");
  if (/\bagitat/i.test(lower)) signals.push("agitation");
  // Refusal structure (incl. messy typing) — not an "eat" product rule
  if (
    /\brefus\w*/i.test(lower) ||
    /\bnot eating|won't eat|will not eat|appetite\b/i.test(lower) ||
    kind === "appetite"
  ) {
    signals.push("appetite");
  }
  if (kind === "fall" || /\bfell\b|\bfall\b/i.test(lower)) signals.push("fall");
  if (kind === "medication_change" || /\bmedication|dose|pill/i.test(lower)) {
    signals.push("medication");
  }
  if (kind === "hospital_discharge" || /\bdischarge/i.test(lower)) signals.push("discharge");
  if (kind === "appointment") signals.push("appointment");
  if (kind === "document") signals.push("document");

  if (signals.length === 0) signals.push("general");
  return [...new Set(signals)];
}

export function collectSituationSignals(
  observations: ReadonlyArray<{ raw_text: string; kind: CareEventKind }>,
): ObservationSignal[] {
  const all: ObservationSignal[] = [];
  for (const o of observations) {
    all.push(...detectObservationSignals(o.raw_text, o.kind));
  }
  return [...new Set(all)];
}

/** Signals from the most recent note — current care state, not the whole history. */
export function latestObservationSignals(
  observations: ReadonlyArray<{ raw_text: string; kind: CareEventKind }>,
): ObservationSignal[] {
  const latest = observations[observations.length - 1];
  if (!latest) return [];
  return detectObservationSignals(latest.raw_text, latest.kind);
}

const EMOTIONAL: ObservationSignal[] = [
  "frustration",
  "sadness",
  "go_home",
  "confusion",
  "agitation",
];

export function isEmotionalSignal(s: ObservationSignal): boolean {
  return EMOTIONAL.includes(s);
}

export function emotionalSignalCount(signals: readonly ObservationSignal[]): number {
  return signals.filter(isEmotionalSignal).length;
}

/**
 * Pattern label for *current* understanding.
 * If the latest note is improvement, do not keep labeling active distress.
 */
export function patternLabelFor(
  signals: readonly ObservationSignal[],
  latestSignals?: readonly ObservationSignal[],
): string | null {
  const latest = latestSignals ?? signals;
  if (latest.includes("improvement")) {
    const priorDistress = emotionalSignalCount(signals) >= 1;
    return priorDistress ? "earlier concern with later improvement" : "feeling better";
  }

  const emotional = emotionalSignalCount(signals);
  if (signals.includes("go_home") && emotional >= 2) {
    return "mood changes with wanting to go home";
  }
  if (emotional >= 3 || (emotional >= 2 && signals.includes("go_home"))) {
    return "several mood changes today";
  }
  if (emotional >= 2) {
    return "mood changes today";
  }
  // No topic keyword pattern labels (fall/appetite/med/discharge) — those are
  // internal signals only, never caregiver-facing pattern copy.
  if (emotional >= 1) {
    return "related care changes today";
  }
  return null;
}

export function isImprovementUpdate(latestSignals: readonly ObservationSignal[]): boolean {
  return latestSignals.includes("improvement");
}

export function detectCompoundSignal(
  observations: ReadonlyArray<{ raw_text: string; kind: CareEventKind }>,
): string | null {
  const allSignals = collectSituationSignals(observations);
  const nonGeneral = allSignals.filter((s) => s !== "general" && s !== "improvement");
  const uniqueNonGeneral = [...new Set(nonGeneral)];

  if (uniqueNonGeneral.length >= 3) {
    const sorted = uniqueNonGeneral.sort();
    return `Multiple care signals appearing together: ${sorted.join(" and ")}`;
  }
  if (uniqueNonGeneral.length === 2) {
    const sorted = uniqueNonGeneral.sort();
    return `Multiple care signals appearing together: ${sorted.join(" and ")}`;
  }

  const emotionalCount = allSignals.filter((s) => isEmotionalSignal(s)).length;
  const domainSignals = allSignals.filter(
    (s) => !isEmotionalSignal(s) && s !== "general" && s !== "improvement",
  );

  if (emotionalCount >= 3 && domainSignals.length >= 1) {
    return "emotional_distress_with_care_domain_shift";
  }
  if (domainSignals.length >= 2) {
    const domains = domainSignals.join(" and ");
    return `multiple_care_domains_affected: ${domains}`;
  }
  if (emotionalCount >= 2 && allSignals.includes("improvement")) {
    return "mixed_emotional_and_improvement_signals";
  }
  return null;
}

export function signalTrajectory(
  observations: ReadonlyArray<{ raw_text: string; kind: CareEventKind }>,
  signal: ObservationSignal,
): "worsening" | "improving" | "stable" | "unknown" {
  if (observations.length === 0) return "unknown";

  const signalObs = observations.filter((o) =>
    detectObservationSignals(o.raw_text, o.kind).includes(signal),
  );
  if (signalObs.length < 2) return "unknown";

  const recent = signalObs.slice(-3);
  const improvingCount = recent.filter((o) => looksLikeImprovementNote(o.raw_text)).length;
  const worseningCount = recent.filter(
    (o) =>
      /\b(worse|more|increased|refus|again|every \d+ minutes)\b/i.test(o.raw_text),
  ).length;

  if (improvingCount > worseningCount && improvingCount >= 2) return "improving";
  if (worseningCount > improvingCount && worseningCount >= 2) return "worsening";
  if (signalObs.length >= 3) return "stable";
  return "unknown";
}

export function computeCrossSignalCorrelation(
  observations: ReadonlyArray<{ raw_text: string; kind: CareEventKind }>,
  signalA: ObservationSignal,
  signalB: ObservationSignal,
): "correlated" | "inverse" | "independent" | "unknown" {
  if (observations.length === 0) return "unknown";

  const aObs = observations.filter((o) =>
    detectObservationSignals(o.raw_text, o.kind).includes(signalA),
  );
  const bObs = observations.filter((o) =>
    detectObservationSignals(o.raw_text, o.kind).includes(signalB),
  );

  if (aObs.length === 0 || bObs.length === 0) return "unknown";

  const aTimestamps = new Set(aObs.map((o) => o.raw_text.slice(0, 50)));
  const overlap = bObs.filter((o) => aTimestamps.has(o.raw_text.slice(0, 50))).length;

  if (overlap >= 1) {
    const aImproving = aObs.some((o) => looksLikeImprovementNote(o.raw_text));
    const bImproving = bObs.some((o) => looksLikeImprovementNote(o.raw_text));
    if (aImproving && !bImproving) return "inverse";
    if (!aImproving && bImproving) return "inverse";
    return "correlated";
  }

  return "independent";
}
