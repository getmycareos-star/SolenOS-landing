/**
 * Output quality — translate Care Reality intelligence into caregiver language.
 * SoT: docs/02-product/solenos-output-quality.md
 * Examples in docs are illustrations only — never product templates.
 */

export const OUTPUT_QUALITY_PURPOSE =
  "Communicate evolving care reality — recognition, connections, decision why — never AI message analysis.";

/** Internal architecture / documentation terms — never primary caregiver-facing copy. */
export const INTERNAL_LANGUAGE_BANS = [
  "care signal",
  "situation model",
  "memory anchor",
  "understanding layer",
  "care state",
  "response intelligence",
  "epistemic",
  "disclosure plan",
  "observation count",
  "crs revision",
  "pipeline",
  "engine output",
  "care notes",
  "stored notes",
  "saved information",
  "note history",
  "supporting notes",
  "evidence maturity",
  "lower attention items",
  "detected keywords",
  "symptom classifier",
  "care story already underway",
  "what is held",
  "held from what you shared",
  "held with",
  "thread source",
  "care story",
  "held in the living care record",
] as const;

export function containsInternalLanguage(text: string): boolean {
  const lower = text.toLowerCase();
  return INTERNAL_LANGUAGE_BANS.some((p) => lower.includes(p));
}

export function scrubInternalLanguage(text: string): string {
  let t = text;
  for (const ban of INTERNAL_LANGUAGE_BANS) {
    const re = new RegExp(ban.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    t = t.replace(re, "").replace(/\s{2,}/g, " ").trim();
  }
  return t;
}

/**
 * True when a "focus" line is still essentially the caregiver's raw note —
 * pasting it into recognition/matters/connection/evidence/follow-ups is echo theater.
 */
export function looksLikeRawNoteDump(
  focus: string | null | undefined,
  latestRawText?: string | null,
): boolean {
  const f = focus?.trim() ?? "";
  if (!f) return false;
  if (f.length >= 90) return true;
  // Commas are not word chars — do not wrap them in \b
  if ((f.match(/(?:\band\b|,)/gi) ?? []).length >= 2 && f.length >= 70) return true;
  const raw = latestRawText?.trim().replace(/\s+/g, " ") ?? "";
  if (raw.length >= 40) {
    const fn = f.toLowerCase().replace(/\s+/g, " ");
    const rn = raw.toLowerCase().replace(/\s+/g, " ");
    const slice = rn.slice(0, Math.min(55, Math.floor(rn.length * 0.6)));
    if (slice.length >= 40 && fn.includes(slice)) return true;
    if (fn.length >= 40 && rn.includes(fn.replace(/\.$/, ""))) return true;
  }
  return false;
}

/**
 * Near-raw caregiver facet — too note-like to quote in connection / evidence / follow-ups,
 * even when under the long-dump thresholds.
 * Short soft notes (e.g. "She's frustrated.") may equal their facet — that is not echo theater.
 */
export function isNearRawCaregiverFacet(
  focus: string | null | undefined,
  latestRawText?: string | null,
): boolean {
  const f = focus?.trim() ?? "";
  if (!f) return false;
  if (looksLikeRawNoteDump(f, latestRawText)) return true;
  const fn = f.toLowerCase().replace(/\s+/g, " ").replace(/\.$/, "");
  const raw = (latestRawText ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  // Verbatim slice of a *long* capture — short notes may equal their facet.
  if (raw.length >= 48 && fn.length >= 16 && raw.includes(fn)) return true;
  // Run-on / multi-clause “facet” (commas are not word chars — do not wrap in \b)
  if (f.length >= 48 && (f.match(/(?:\band\b|,|;)/gi) ?? []).length >= 1) return true;
  // Long enough that quoting it reads as pasting a note
  if (f.length >= 55) return true;
  return false;
}

/**
 * Caregiver copy contains a long contiguous dump of the raw note (echo theater).
 * Short structured facets that also appear in the note are allowed on recognition only
 * when under dump thresholds — connection / evidence / follow-up paste templates always fail.
 */
export function containsRawNoteEchoInCopy(params: {
  blob: string;
  latestRawText: string;
}): boolean {
  const blob = params.blob;
  // Explicit paste templates — reject regardless of length math.
  if (/what stands out(?:\s+for\s+[\w'’]+)?:\s*[^.\n]{75,}/i.test(blob)) return true;
  if (/noticing whether this continues\s*\([^)]{40,}\)/i.test(blob)) return true;
  if (/first timeline entry(?:\s+for\s+[\w'’]+)?:\s*[^.\n]{75,}/i.test(blob)) return true;
  // Connection / follow-up paste theater — never embed prior raw in parentheses or quote near-raw focus.
  if (/this connects to what was already held\s*\([^)]{12,}\)/i.test(blob)) return true;
  if (/notice whether\s*[“"'][^“"']{20,}[”"']/i.test(blob)) return true;
  // Evidence “Related:” join — reject near-raw facets / contiguous latest dump (structured short facets OK).
  const relatedMatch = blob.match(/\brelated:\s*([^\n]+)/i);
  if (relatedMatch) {
    const segment = relatedMatch[1]!.trim();
    for (const part of segment.split(/\s*·\s*/)) {
      if (isNearRawCaregiverFacet(part, params.latestRawText)) return true;
    }
  }

  const raw = params.latestRawText.trim().toLowerCase().replace(/\s+/g, " ");
  if (raw.length < 70) return false;
  const normalized = blob.toLowerCase().replace(/\s+/g, " ");
  const sliceLen = Math.min(95, Math.max(70, Math.floor(raw.length * 0.65)));
  if (raw.length < sliceLen) return false;
  return normalized.includes(raw.slice(0, sliceLen));
}

/**
 * Short situation-grounded recognition — not empathy theater.
 * Never paste the caregiver's full note into "What stands out".
 */
export function composeRecognitionLine(params: {
  isNewCareReality: boolean;
  isCompeting: boolean;
  hasCaregiverLoad: boolean;
  heldFocus: string | null;
  subjectLabel: string | null;
  latestRawText?: string | null;
}): string | null {
  const who =
    params.subjectLabel &&
    params.subjectLabel !== "they" &&
    params.subjectLabel !== "Your loved one"
      ? params.subjectLabel
      : null;

  if (params.hasCaregiverLoad && params.isNewCareReality) {
    return "A lot is unsettled at once. What follows organizes what is already clear from what you shared.";
  }
  if (params.isCompeting) {
    return "More than one care concern is present at once — kept so nothing has to be carried only in memory.";
  }
  if (params.hasCaregiverLoad) {
    return "The weight of keeping this straight is part of the care reality — kept with this, not set aside.";
  }
  const focus = params.heldFocus?.trim() ?? "";
  // New Care Reality: never paste a capture facet into "What stands out" — that reads as note echo.
  if (params.isNewCareReality) {
    return who
      ? `Several care concerns about ${who} are gathered from what you shared — organized so they stay connected.`
      : "Several care concerns are gathered from what you shared — organized so they stay connected.";
  }
  if (focus && !looksLikeRawNoteDump(focus, params.latestRawText)) {
    const short = focus.replace(/\.$/, "");
    // Returning only — short structured facet, never the whole capture.
    if (short.length <= 72) {
      return who
        ? `What stands out for ${who}: ${short}.`
        : `What stands out: ${short}.`;
    }
  }
  if (who) {
    return `What you shared about ${who} connects to what was already noted — part of the same care record.`;
  }
  return "What you shared connects to what was already noted — part of the same care record.";
}

/**
 * Connection line for returning care reality — pattern continuity, not isolated note.
 * Never embed prior raw / near-raw blobs in parentheses.
 */
export function composeConnectionLine(params: {
  isNewCareReality: boolean;
  priorFact: string | null;
  latestFact: string | null;
  observationCount: number;
}): string | null {
  if (params.isNewCareReality) return null;
  const prior = params.priorFact?.trim() ?? "";
  const latest = params.latestFact?.trim() ?? "";
  // Continuity only when prior is real care reality — never greeting / product meta.
  // Speak the relationship; never paste the prior sentence into caregiver copy.
  if (
    prior &&
    latest &&
    prior.toLowerCase() !== latest.toLowerCase() &&
    !isNearRawCaregiverFacet(prior)
  ) {
    return "This connects to what was already noted — part of the same care situation.";
  }
  if (params.observationCount >= 2 || Boolean(prior)) {
    return "This connects to what was already noted — part of the same care situation.";
  }
  return null;
}

/**
 * What matters now = most important next understanding (not echo / task list).
 * Never paste the caregiver's full note into this pillar.
 */
export function buildMattersNowOrientation(params: {
  subjectLabel: string | null;
  baselineChange: string | null;
  heldFocus: string | null;
  topUnknown: string | null;
  patternContinues?: boolean;
  latestRawText?: string | null;
}): string {
  const who =
    params.subjectLabel &&
    params.subjectLabel !== "they" &&
    params.subjectLabel !== "Your loved one"
      ? params.subjectLabel
      : null;

  if (params.baselineChange?.trim()) {
    // Never append the full change blob — that reintroduces raw-note echo into What matters.
    return who
      ? `Most important next: whether this change from ${who}'s usual continues, and what connects to it — not proving a cause today.`
      : `Most important next: whether this change from their usual continues, and what connects to it — not proving a cause today.`;
  }

  const focus = params.heldFocus?.trim() ?? "";
  const focusIsDump = looksLikeRawNoteDump(focus, params.latestRawText);
  // Short structured facet only — never quote a run-on note as "what matters".
  if (focus && !focusIsDump && focus.length <= 72) {
    return params.patternContinues
      ? `Most important next: whether this keeps appearing and what surrounds it — without itemizing every action tonight.`
      : `Most important next: how this sits with what was usual, and what else connects — without deciding everything tonight.`;
  }

  if (params.topUnknown?.trim()) {
    const ask = params.topUnknown.trim().replace(/\?$/, "");
    return `Most important next: ${ask}? — that would reduce uncertainty more than listing every detail.`;
  }

  return who
    ? `Most important next: how these concerns sit against what was usual for ${who}, and what else connects — without deciding everything tonight.`
    : "Most important next: how these concerns sit against what was usual, and what else connects — without deciding everything tonight.";
}

/**
 * Caregiver-facing decision memory lines — why, not advice.
 */
export function formatDecisionMemoryForCaregiver(params: {
  what: string;
  reason: string | null;
  who: readonly string[];
  outcome: string | null;
  status: string;
}): string[] {
  const lines: string[] = [];
  const what = scrubInternalLanguage(params.what.trim());
  if (!what) return [];
  lines.push(`Decision held: ${what.replace(/\.$/, "")}.`);
  if (params.reason?.trim()) {
    lines.push(`Reason held: ${params.reason.trim().replace(/\.$/, "")}.`);
  } else {
    lines.push("Why this path was chosen is not held yet.");
  }
  if (params.who.length > 0) {
    lines.push(`People involved: ${params.who.slice(0, 3).join(", ")}.`);
  }
  if (params.outcome?.trim()) {
    lines.push(`Outcome held: ${params.outcome.trim().replace(/\.$/, "")}.`);
  } else if (params.status === "pending" || params.status === "active") {
    lines.push("Outcome not yet known — will update when clearer.");
  }
  return lines.slice(0, 4);
}

export function looksLikeCaregiverLoadLanguage(text: string): boolean {
  const t = text.toLowerCase();
  return (
    /don'?t even know where to start/.test(t) ||
    /tired of (trying to )?remember/.test(t) ||
    /overwhelmed|exhausted/.test(t) ||
    /nobody else (sees|notices)/.test(t) ||
    /carrying (too )?much/.test(t)
  );
}

/** What SolenOS preserves for future care continuity — care story update section. */
export function composeCareStoryUpdate(params: {
  isNewCareReality: boolean;
  subjectLabel: string | null;
  /** Primary held focus from this turn — evidence-derived when available. */
  heldFocus?: string | null;
  /** What changed vs prior understanding — returning users. */
  whatChanged?: string | null;
  /** Recent decision held in memory — surface why-path preservation. */
  decisionWhat?: string | null;
  /** Open gaps still tracked in the record. */
  openUnknownCount?: number;
}): string {
  const who = params.subjectLabel?.trim();
  const named =
    who && who !== "they" && who !== "Your loved one" && who !== "person" ? who : null;

  const decision = params.decisionWhat?.trim().replace(/\.$/, "");
  if (decision) {
    // Keep decision memory visible without dumping a full multi-clause note.
    const shortDecision =
      decision.length > 90
        ? `${decision.slice(0, 87).replace(/\s+\S*$/, "")}…`
        : decision;
    return named
      ? `Decision saved in ${named}'s care record: ${shortDecision} — the reason will be added when it becomes clear.`
      : `Decision saved in the care record: ${shortDecision} — the reason will be added when it becomes clear.`;
  }

  const change = params.whatChanged?.trim().replace(/\.$/, "");
  if (!params.isNewCareReality && change && change.length <= 140) {
    return named
      ? `Added to ${named}'s care record: ${change}.`
      : `Added to the care record: ${change}.`;
  }

  const focus = params.heldFocus?.trim().replace(/\.$/, "") ?? "";
  // Never paste a raw multi-clause note (or first short echo) as the first timeline entry.
  if (params.isNewCareReality) {
    const unknownNote =
      (params.openUnknownCount ?? 0) > 0 ? " — unknowns stay open." : ".";
    return named
      ? `First entries for ${named} are saved in the care record${unknownNote}`
      : `First entries are saved in the care record${unknownNote}`;
  }
  if (focus && focus.length <= 72 && !looksLikeRawNoteDump(focus)) {
    return named
      ? `Added to ${named}'s care record: ${focus}.`
      : `Added to the care record: ${focus}.`;
  }
  return named
    ? `Added to ${named}'s care record — changes, decisions, and unknowns stay connected over time.`
    : "Added to the care record — changes, decisions, and unknowns stay connected over time.";
}
