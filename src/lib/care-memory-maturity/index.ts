/**
 * Care memory maturity — first vs returning Care Reality orientation.
 * SoT: docs/02-product/solenos-first-vs-returning-user.md
 * Confirmation gate: docs/02-product/solenos-response-contract.md (Relief disclosure decision)
 * Examples in docs are illustrations only — never product templates.
 */

import type { CaregiverTurnClass } from "../response-behavior";
import type { CareEventKind } from "../living-care-record-ux/event-clarifiers";
import { isProductSessionMetaText } from "../care-epistemics";

export const CARE_MEMORY_MATURITY_PURPOSE =
  "Orient as beginning a care story (new) or continuing one (returning) — never fake continuity, never restart.";

/** Caregiver-facing storage/continuity chrome — forbidden until careWorthyCount ≥ 1 and turn is care-worthy. */
export const CARE_STORY_CHROME_PATTERNS = [
  /\badded to (?:the|[\w']+'s) care story\b/i,
  /\bcare story already underway\b/i,
  /\bbeginning of (?:the|[\w']+'s) living care record\b/i,
  /\badded to (?:the|[\w']+'s) living care record\b/i,
  /\bupdated (?:the|[\w']+'s) living care record\b/i,
  /\bthis becomes part of (?:the|[\w']+'s) ongoing care story\b/i,
  /\bconnected to what is already held\b/i,
] as const;

export function containsCareStoryChrome(text: string): boolean {
  return CARE_STORY_CHROME_PATTERNS.some((p) => p.test(text));
}

export type CareMemoryState = "new_care_reality" | "returning_care_reality";

/** Phrases that invent prior relationship when none exists. */
export const FAKE_CONTINUITY_PHRASES = [
  "stays connected to what is already held",
  "stays connected to what was already held",
  "connected to what you already shared",
  "as we previously",
  "as we already discussed",
  "picking up where we left off",
  "from our last conversation",
] as const;

export function containsFakeContinuity(text: string): boolean {
  const lower = text.toLowerCase();
  return FAKE_CONTINUITY_PHRASES.some((p) => lower.includes(p));
}

/**
 * Classify from held care-memory depth — not chat session flags.
 * Returning once there is prior *care* observation history (or CRS revisions).
 * Product/meta session notes do not count as care memory.
 */
export function classifyCareMemoryState(params: {
  observationCount: number;
  crsRevision?: number | null;
  crsObservationCount?: number | null;
  /** Count of observations that are care-reality anchors (not product meta). */
  careWorthyObservationCount?: number | null;
}): CareMemoryState {
  const careWorthy =
    params.careWorthyObservationCount != null
      ? params.careWorthyObservationCount
      : Math.max(params.observationCount, params.crsObservationCount ?? 0);
  const revision = params.crsRevision ?? 0;
  // First care-worthy capture (or only meta so far) = beginning the care story.
  if (careWorthy <= 1) return "new_care_reality";
  if (revision <= 1 && careWorthy <= 1) return "new_care_reality";
  return "returning_care_reality";
}

export function isNewCareReality(params: {
  observationCount: number;
  crsRevision?: number | null;
  crsObservationCount?: number | null;
}): boolean {
  return classifyCareMemoryState(params) === "new_care_reality";
}

/**
 * Confirmation for first capture — beginning of understanding, not storage theater.
 */
export function composeNewCareRealityConfirmation(params: {
  subjectLabel: string | null;
}): string {
  const who = params.subjectLabel?.trim();
  if (who && who !== "they" && who !== "Your loved one" && who !== "person") {
    return `${who}'s Care Record starts here. The details you share can stay together, so you do not have to piece them together later.`;
  }
  return "Your Care Record starts here. The details you share can stay together, so you do not have to piece them together later.";
}

/**
 * Confirmation when care memory already exists.
 */
export function composeReturningCareRealityConfirmation(params: {
  subjectLabel: string | null;
}): string {
  const who = params.subjectLabel?.trim();
  if (who && who !== "they" && who !== "Your loved one" && who !== "person") {
    return `Updated ${who}'s Care Record. The new details are kept with the earlier information.`;
  }
  return "Your Care Record has been updated with the new details and the earlier information.";
}

/** No care-worthy evidence in the record yet — never "Added to the care story". */
export function composeAwaitingCareEvidenceConfirmation(params: {
  subjectLabel: string | null;
}): string {
  const who = params.subjectLabel?.trim();
  if (who && who !== "they" && who !== "Your loved one" && who !== "person") {
    return `There are no care details saved for ${who} yet. You can share what is happening in a note, document, or photo.`;
  }
  return "There are no care details saved yet. You can share what is happening in a note, document, or photo.";
}

/** Recognition when the record has no care anchors yet. */
export function composeAwaitingCareEvidenceRecognition(): string {
  return "Share what is happening with care when you are ready — fragments are fine.";
}

/** Recognition when this turn is product meta but prior care evidence exists. */
export function composeProductMetaTurnRecognition(): string {
  return "That note was about using SolenOS, not about care. The care details you shared earlier are still saved.";
}

/** Latest turn is product/session meta — not a care observation. */
export function composeProductMetaTurnConfirmation(params: {
  hasPriorCareEvidence: boolean;
  subjectLabel: string | null;
}): string {
  if (params.hasPriorCareEvidence) {
    return "That note was about using SolenOS, not about care. The care details you shared earlier are still saved.";
  }
  return composeAwaitingCareEvidenceConfirmation({ subjectLabel: params.subjectLabel });
}

/** G17 — hold mismatched note; one soft ask; never care-story theater. */
export function composeIdentityMismatchConfirmation(params: {
  activeSubjectLabel: string | null;
}): string {
  const who = params.activeSubjectLabel?.trim();
  const named =
    who && who !== "Your loved one" && who !== "they" && who !== "person" ? who : null;
  return named
    ? `This note has been set aside. It will not be added to ${named}'s Care Record until we know who it is about.`
    : "This note has been set aside. It will not be added to the Care Record until we know who it is about.";
}

export function composeIdentityMismatchRecognition(params: {
  activeSubjectLabel: string | null;
}): string {
  const who = params.activeSubjectLabel?.trim();
  const named =
    who && who !== "Your loved one" && who !== "they" && who !== "person" ? who : null;
  return named
    ? `The saved details about ${named} have not changed. This new note may be about someone else.`
    : "The saved care details have not changed. This new note may be about someone else.";
}

/**
 * Single confirmation gate — care-story / LCR chrome only when careWorthyCount ≥ 1
 * and the current turn is care-worthy. Product meta never earns "Added to the care story".
 */
export function resolveCareTurnConfirmation(params: {
  turnClass: CaregiverTurnClass;
  subjectLabel: string | null;
  careWorthyCount: number;
  latestIsCareWorthy: boolean;
  hasCareEvidence: boolean;
  isNewCareReality: boolean;
  gatheringContext: boolean;
  priorObservationFactsCount: number;
  continuitySymptom: boolean;
  improvement: boolean;
  hasDocuments: boolean;
  kind: CareEventKind;
  relation?: string;
  patternLabel?: string | null;
  latestRawText: string;
}): string {
  const who = params.subjectLabel?.trim();
  const named =
    who && who !== "Your loved one" && who !== "they" && who !== "person" ? who : null;

  if (params.turnClass === "pushback") {
    return "Understood — that question will not be asked again.";
  }
  if (params.turnClass === "identity_mismatch") {
    return composeIdentityMismatchConfirmation({ activeSubjectLabel: params.subjectLabel });
  }
  if (params.turnClass === "empty_or_thin") {
    return "Nothing new was added.";
  }
  if (params.turnClass === "record_question") {
    return named
      ? `Using the care details saved for ${named}.`
      : "Using the care details saved in your Care Record.";
  }

  // Locked: no care anchors yet — invite only; never care-story / LCR theater.
  if (params.careWorthyCount <= 0 || !params.hasCareEvidence) {
    return composeAwaitingCareEvidenceConfirmation({ subjectLabel: named });
  }

  // Locked: product/session meta turn — prior care may exist; this turn does not add to the care story.
  if (
    !params.latestIsCareWorthy &&
    isProductSessionMetaText(params.latestRawText)
  ) {
    return composeProductMetaTurnConfirmation({
      hasPriorCareEvidence: true,
      subjectLabel: named,
    });
  }

  if (params.improvement) {
    return named
      ? `Updated what we understand about ${named} — the latest change is the current picture.`
      : "Updated what we understand — the latest change is the current picture.";
  }

  // Thin follow-up without a new care anchor — do not claim LCR / care-story update.
  if (
    !params.latestIsCareWorthy &&
    !isProductSessionMetaText(params.latestRawText) &&
    !["continuity_symptom", "improvement", "answer_to_open"].includes(params.turnClass)
  ) {
    if (params.gatheringContext) {
      return named
        ? `The details shared about ${named} are saved in the Care Record. A couple of details would help before deciding what matters.`
        : "The care details shared so far are saved. A couple of details would help before deciding what matters.";
    }
    return named
      ? `What we understand about ${named}'s care continues — share what changed when you can.`
      : "What we already understand continues — share what changed when you can.";
  }

  // careWorthyCount ≥ 1 and current turn is care-worthy — care continuity confirmations allowed.
  if (params.turnClass === "emotional_only") {
    return params.isNewCareReality
      ? composeNewCareRealityConfirmation({ subjectLabel: named })
      : composeReturningCareRealityConfirmation({ subjectLabel: named });
  }

  if (params.turnClass === "document" || (params.hasDocuments && params.kind === "document")) {
    return params.isNewCareReality
      ? composeNewCareRealityConfirmation({ subjectLabel: named })
      : composeReturningCareRealityConfirmation({ subjectLabel: named });
  }

  if (
    params.continuitySymptom &&
    params.priorObservationFactsCount > 0 &&
    !params.gatheringContext
  ) {
    return "Here are the care details already saved. This is not a recommendation about what to choose.";
  }

  if (params.gatheringContext) {
    return named
      ? `The details shared about ${named} are saved in the Care Record. A couple of details would help before deciding what matters.`
      : "The care details shared so far are saved. A couple of details would help before deciding what matters.";
  }

  if (
    params.isNewCareReality ||
    params.relation === "opens_new" ||
    params.careWorthyCount <= 1
  ) {
    return composeNewCareRealityConfirmation({ subjectLabel: named });
  }

  if (params.patternLabel === "day-to-day fluctuation") {
    return named
      ? `Updated ${named}'s record — today can look different from recent days.`
      : "Updated — today can look different from recent days.";
  }

  if (params.patternLabel === "gradual daily-living changes") {
    return named
      ? `Updated ${named}'s Care Record. Small changes over time are kept together.`
      : "Your Care Record has been updated. Small changes over time are kept together.";
  }

  return composeReturningCareRealityConfirmation({ subjectLabel: named });
}

/** Caregiver note chip — never "Added to the care story" until careWorthyCount ≥ 1 and latest is care-worthy. */
export function caregiverNoteMetaLabel(params: {
  careWorthyCount: number;
  latestIsCareWorthy: boolean;
}): string {
  if (params.careWorthyCount <= 0) {
    return "Waiting for care to share";
  }
  if (params.latestIsCareWorthy) {
    return "Added to your Care Record";
  }
  return "About SolenOS — what you share stays in your Care Record";
}

/**
 * Soft orientation when understanding is thin — state-aware.
 */
export function composeMemoryAwareSoftSummary(params: {
  state: CareMemoryState;
}): string {
  if (params.state === "new_care_reality") {
    return "Beginning to understand this care situation — saved so you do not have to reconstruct it alone later.";
  }
  return "As you add more, your earlier care details stay together in your Care Record.";
}

/**
 * What changed / first-anchor line — never invent prior comparison for new users.
 */
export function composeMemoryAwareWhatChanged(params: {
  state: CareMemoryState;
  baselineChangeNote?: string | null;
  priorFact?: string | null;
  latestFact?: string | null;
}): string {
  if (params.baselineChangeNote?.trim()) {
    return params.baselineChangeNote.trim();
  }
  if (params.state === "new_care_reality") {
    return "Your first care updates are saved. Anything unclear will stay marked as not sure until more information is available.";
  }
  const prior = params.priorFact?.trim();
  const latest = params.latestFact?.trim();
  if (prior && latest && prior.toLowerCase() !== latest.toLowerCase()) {
    return `New: ${latest.replace(/\.$/, "")}. Earlier: ${prior.replace(/\.$/, "")}.`;
  }
  return "New updates stay with the earlier care details, so you do not have to piece everything together again.";
}

/**
 * Returning orientation: already known vs new (caregiver-facing lines).
 */
export function composeReturningOrientationLines(params: {
  priorFacts: readonly string[];
  latestFacts: readonly string[];
  max?: number;
}): { already_known: string[]; what_is_new: string[] } {
  const max = params.max ?? 2;
  const prior = params.priorFacts.map((f) => f.trim()).filter(Boolean);
  const latest = params.latestFacts.map((f) => f.trim()).filter(Boolean);
  const priorLower = new Set(prior.map((p) => p.toLowerCase()));
  const what_is_new = latest
    .filter((l) => !priorLower.has(l.toLowerCase()))
    .slice(0, max);
  const already_known = prior.slice(0, max);
  return { already_known, what_is_new };
}
