/**
 * Explicit caregiver memory correction detection (Slice 2.4 / Phase 12).
 *
 * Principle-based discourse cues + token overlap with held observations.
 * Never scenario noun templates (fall / frustrated / sad / …).
 * Same detector for text, document, snap, scan, upload — origin is attribution only.
 */

import type { ActiveCareSituation, SituationObservation } from "../active-care-situation/types";
import { contentTokens, tokenOverlapCount } from "../care-epistemics";

/**
 * Structural correction discourse — not topic keywords.
 * Matches caregiver rejecting prior held belief, in any wording family.
 * Apostrophe class includes ASCII + typographic ’ (U+2019).
 */
const AP = "['\u2019]";
const EXPLICIT_CORRECTION_CUE = new RegExp(
  String.raw`\b(?:` +
    String.raw`that${AP}?s\s+(?:wrong|not\s+(?:right|what\s+happened|true|correct))` +
    String.raw`|that\s+is\s+(?:wrong|not\s+(?:right|true|correct))` +
    String.raw`|not\s+(?:true|correct)` +
    String.raw`|(?:didn${AP}?t|did\s+not)\s+happen` +
    String.raw`|never\s+happened` +
    String.raw`|i\s+(?:was\s+wrong|misspoke|got\s+that\s+wrong)` +
    String.raw`|actually[,.]?\s+(?:she|he|they|we)\s+(?:didn${AP}?t|did\s+not|never)` +
    String.raw`|correction\s*:` +
    String.raw`|wait[,.]?\s+that${AP}?s\s+not\s+right` +
    String.raw`|you${AP}?re\s+wrong` +
    String.raw`|that\s+never` +
    String.raw`|hold\s+on[,.]?\s+(?:that${AP}?s|that\s+is)\s+(?:wrong|not)` +
    String.raw`|i\s+need\s+to\s+correct` +
    String.raw`)`,
  "i",
);

/** Negation frames that introduce a retracted predicate — structural, not topic lists. */
const NEGATION_PREDICATE = new RegExp(
  String.raw`\b(?:didn${AP}?t|did\s+not|doesn${AP}?t|does\s+not|never|wasn${AP}?t|was\s+not|weren${AP}?t|were\s+not|isn${AP}?t|is\s+not|no)\s+(?:a\s+|an\s+|the\s+)?([a-z][a-z'-]{2,})`,
  "gi",
);

const NEGATION_STOP = new Set([
  "the",
  "and",
  "for",
  "her",
  "his",
  "him",
  "she",
  "they",
  "them",
  "that",
  "this",
  "with",
  "from",
  "have",
  "been",
  "were",
  "was",
  "are",
  "not",
  "really",
  "actually",
  "just",
  "even",
  "about",
  "what",
  "when",
  "where",
  "true",
  "right",
  "wrong",
  "correct",
  "happen",
  "happened",
]);

/** Caregiver explicitly rejects prior held understanding. */
export function looksLikeExplicitMemoryCorrection(text: string): boolean {
  return EXPLICIT_CORRECTION_CUE.test(text.trim());
}

/**
 * Content tokens negated in the correction ("didn't X", "never Y").
 * Principle: extract predicates after negation — never a fixed event vocabulary.
 */
export function negatedContentTokensFromCorrection(text: string): string[] {
  const out = new Set<string>();
  const t = text.toLowerCase();
  NEGATION_PREDICATE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = NEGATION_PREDICATE.exec(t)) !== null) {
    const w = (m[1] ?? "").toLowerCase().replace(/[^a-z'-]/g, "");
    if (w.length >= 3 && !NEGATION_STOP.has(w)) out.add(w);
  }
  return [...out];
}

/** Caregiver-facing corrected claim after explicit correction cue. */
export function extractCorrectedClaimFromCorrection(rawText: string): string {
  const trimmed = rawText.trim();
  const dashParts = trimmed.split(/[—–-]/).map((p) => p.trim()).filter(Boolean);
  if (dashParts.length >= 2) {
    const tail = dashParts[dashParts.length - 1]!;
    if (tail.length >= 6) return tail;
  }
  const stripped = trimmed
    .replace(
      new RegExp(
        String.raw`^.*?\b(?:that${AP}?s\s+(?:wrong|not\s+(?:right|true|correct))|that\s+is\s+(?:wrong|not\s+(?:right|true|correct))|not\s+true|correction\s*:|i\s+(?:was\s+wrong|misspoke)|wait[,.]?\s+that${AP}?s\s+not\s+right)\s*[—–,-]?\s*`,
        "i",
      ),
      "",
    )
    .trim();
  if (stripped.length >= 6) return stripped;
  return trimmed;
}

function observationBlob(o: SituationObservation): string {
  return `${o.human_fact} ${o.raw_text}`.trim();
}

/** Light morphology / vowel-skeleton match — not a topic vocabulary. */
function stemsCompatible(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a))) return true;
  const skeleton = (w: string) => w.replace(/[aeiou]/g, "");
  const sa = skeleton(a);
  const sb = skeleton(b);
  return sa.length >= 3 && sa === sb;
}

/**
 * Observation the caregiver is retracting.
 * Prefer strongest content-token overlap with negated predicates / corrected claim;
 * otherwise the latest held observation (explicit correction without clear topic).
 */
export function findCorrectionTargetObservation(
  active: ActiveCareSituation,
  rawText: string,
): SituationObservation | null {
  if (!looksLikeExplicitMemoryCorrection(rawText) || active.observations.length === 0) {
    return null;
  }

  const negated = negatedContentTokensFromCorrection(rawText);
  const claimTokens = contentTokens(extractCorrectedClaimFromCorrection(rawText));
  const queryTokens = [...new Set([...negated, ...claimTokens])];

  let best: SituationObservation | null = null;
  let bestScore = 0;

  for (const obs of [...active.observations].reverse()) {
    if (obs.disputed_by_correction_id) continue;
    const blob = observationBlob(obs).toLowerCase();
    const blobTokens = contentTokens(observationBlob(obs));
    if (blobTokens.length === 0) continue;

    let score = tokenOverlapCount(queryTokens, blobTokens);
    for (const n of negated) {
      if (blob.includes(n) || blobTokens.some((t) => stemsCompatible(n, t))) {
        score += 2;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = obs;
    }
  }

  if (best && bestScore > 0) return best;
  // Explicit correction with no token match → correct the latest held belief.
  return (
    [...active.observations].reverse().find((o) => !o.disputed_by_correction_id) ??
    active.observations[active.observations.length - 1] ??
    null
  );
}
