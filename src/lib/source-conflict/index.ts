/**
 * Source Conflict (G12) — document vs note (or opposing sources).
 *
 * Principle: keep both; flag conflict; prefer current fact for orientation
 * without erasing earlier evidence. Never silent winner.
 *
 * Not illustration-keyword product — topic overlap + opposing polarity.
 */

import type { CareEventKind } from "../living-care-record-ux/event-clarifiers";
import {
  livingCareRecordDataDir,
  readDurableJson,
  sanitizeDurableCareKey,
  writeDurableJson,
  clearDurableDirectory,
  withDurableFileLock,
} from "../living-care-record-persistence/fs-store";

export const SOURCE_CONFLICT_PURPOSE =
  "Hold conflicting sources together — current fact for orientation, nothing erased.";

export type ObservationSourceRef = {
  raw_text: string;
  kind: CareEventKind;
  captured_at: string;
  /** When set, opposing polarity across contributors is a conflict — both retained. */
  contributor_id?: string | null;
  /** Explicit speaker within the source; distinct from the authenticated reporter. */
  speaker_label?: string | null;
  speaker_attribution_status?: "explicit" | "unknown";
  source_reference_id?: string | null;
};

export type SourceConflictEvaluation = {
  has_conflict: boolean;
  /** Higher-priority source (clinical > document > note) for orientation — both remain stored. */
  priority_for_orientation: "incoming" | "prior" | "neither";
  prior_text: string | null;
  incoming_text: string | null;
  note: string | null;
  pattern_label: string | null;
  open_ask: string | null;
  /** Both sides retained — never erase. */
  both_retained: true;
};

type ClaimStore = {
  care_key: string;
  claims: ObservationSourceRef[];
  updated_at: string;
};

const claimMemory = new Map<string, ClaimStore>();

function claimPath(careKey: string): string {
  return livingCareRecordDataDir(
    "source-claims",
    `${sanitizeDurableCareKey(careKey)}.json`,
  );
}

function loadClaims(careKey: string): ClaimStore {
  const cached = claimMemory.get(careKey);
  if (cached) return cached;
  const durable = readDurableJson<ClaimStore>(claimPath(careKey));
  if (durable?.claims) {
    claimMemory.set(careKey, durable);
    return durable;
  }
  return { care_key: careKey, claims: [], updated_at: new Date().toISOString() };
}

function saveClaims(store: ClaimStore): void {
  claimMemory.set(store.care_key, store);
  writeDurableJson(claimPath(store.care_key), store);
}

/** Persist a source claim so conflicts survive ACS opens_new. */
export function recordSourceClaim(params: {
  careKey: string;
  rawText: string;
  kind: CareEventKind;
  capturedAt?: string;
  contributorId?: string | null;
  speakerLabel?: string | null;
  speakerAttributionStatus?: "explicit" | "unknown";
  sourceReferenceId?: string | null;
}): void {
  const now = params.capturedAt ?? new Date().toISOString();
  const claim: ObservationSourceRef = {
    raw_text: params.rawText.trim(),
    kind: params.kind,
    captured_at: now,
    contributor_id: params.contributorId ?? null,
    speaker_label: params.speakerLabel ?? null,
    speaker_attribution_status: params.speakerAttributionStatus ?? "unknown",
    source_reference_id: params.sourceReferenceId ?? null,
  };
  withDurableFileLock(`${claimPath(params.careKey)}.lock`, () => {
    // Always refresh from durable storage inside the lock. A process-local
    // cache may be stale when another worker records a caregiver observation.
    const durable = readDurableJson<ClaimStore>(claimPath(params.careKey));
    const store = durable?.claims
      ? durable
      : { care_key: params.careKey, claims: [], updated_at: now };
    // This is an audit ledger, not a rolling context window. Never silently
    // discard older source claims when the record grows beyond an arbitrary cap.
    const next = [...store.claims, claim];
    const updated = { care_key: params.careKey, claims: next, updated_at: now };
    saveClaims(updated);
  });
}

export function listSourceClaims(careKey: string): ObservationSourceRef[] {
  const durable = readDurableJson<ClaimStore>(claimPath(careKey));
  if (durable?.claims) {
    claimMemory.set(careKey, durable);
    return [...durable.claims];
  }
  return [...loadClaims(careKey).claims];
}

export function resetSourceConflictStore(): void {
  claimMemory.clear();
  clearDurableDirectory(livingCareRecordDataDir("source-claims"));
}


function isDocumentLike(kind: CareEventKind): boolean {
  return (
    kind === "document" ||
    kind === "hospital_discharge" ||
    kind === "appointment"
  );
}

function isNoteLike(kind: CareEventKind): boolean {
  return !isDocumentLike(kind);
}

/**
 * Input Reality source rank — clinical artifacts outrank caregiver memory notes
 * for current-fact orientation. Both sides always retained.
 */
export function sourcePriorityRank(kind: CareEventKind, rawText = ""): number {
  const t = rawText.toLowerCase();
  if (
    kind === "hospital_discharge" ||
    /\b(discharge|discharged|hospital discharge|after.?visit summary|avs)\b/i.test(t)
  ) {
    return 100;
  }
  if (
    kind === "document" ||
    kind === "appointment" ||
    /\[document:|per (?:the )?records?\b|from the (?:hospital|clinic)\b/i.test(t)
  ) {
    return 80;
  }
  return 20;
}

type Topic =
  | "eating"
  | "medication"
  | "mobility"
  | "sleep"
  | "other";

function detectTopic(text: string): Topic {
  const t = text.toLowerCase();
  if (/\b(eat|ate|eating|appetite|food|meal|dinner|lunch|breakfast|plate)\b/.test(t)) {
    return "eating";
  }
  if (/\b(medication|medicine|pill|dose|rx|prescription|taking)\b/.test(t)) {
    return "medication";
  }
  if (/\b(walk|walking|fell|fall|mobility|stood|standing)\b/.test(t)) {
    return "mobility";
  }
  if (/\b(sleep|sleeping|slept|nap|awake)\b/.test(t)) {
    return "sleep";
  }
  return "other";
}

/** +1 affirming / functioning · -1 declining / refusing · 0 neutral */
function polarity(text: string, topic: Topic): number {
  const t = text.toLowerCase();
  if (topic === "eating") {
    if (/\b(ate (?:well|better|normally)|eating (?:well|better|normally)|good appetite|finished)\b/.test(t)) {
      return 1;
    }
    if (/\b(refus|barely ate|not eat|won'?t eat|pushed .{0,20}(?:plate|food)|no appetite)\b/.test(t)) {
      return -1;
    }
  }
  if (topic === "medication") {
    if (/\b(started|prescribed|taking|continues? (?:on|taking)|still (?:on|taking))\b/.test(t)) {
      return 1;
    }
    if (/\b(stopp?ed|not taking|discontinued|held the|missed .{0,20}(?:dose|med))\b/.test(t)) {
      return -1;
    }
  }
  if (topic === "mobility") {
    if (/\b(walked|walking (?:well|better)|steady|stood)\b/.test(t) && !/\b(fell|fall|couldn'?t)\b/.test(t)) {
      return 1;
    }
    if (/\b(fell|fallen|couldn'?t walk|unable to walk|unsteady)\b/.test(t)) {
      return -1;
    }
  }
  if (topic === "sleep") {
    if (/\b(slept (?:well|through)|rested|good night)\b/.test(t)) return 1;
    if (/\b(not sleep|couldn'?t sleep|up all night|sleeping (?:a lot|all day))\b/.test(t)) {
      return -1;
    }
  }
  return 0;
}

function sourcesDiffer(
  a: ObservationSourceRef,
  b: ObservationSourceRef,
): boolean {
  const docMark =
    /\[document:|discharge|from the (?:hospital|clinic)|per (?:the )?records?\b/i;
  return (
    (isDocumentLike(a.kind) && isNoteLike(b.kind)) ||
    (isNoteLike(a.kind) && isDocumentLike(b.kind)) ||
    docMark.test(a.raw_text) !== docMark.test(b.raw_text)
  );
}

/** Distinct contributors with opposing claims — keep both; never silent winner. */
function multiContributorOppose(
  a: ObservationSourceRef,
  b: ObservationSourceRef,
): boolean {
  const aId = (a.contributor_id ?? "").trim();
  const bId = (b.contributor_id ?? "").trim();
  return Boolean(aId && bId && aId !== bId);
}

/**
 * Detect opposing document vs note (or opposing sources) on the same topic.
 */
export function evaluateSourceConflict(params: {
  careKey?: string;
  priorObservations?: readonly ObservationSourceRef[];
  incomingText: string;
  incomingKind: CareEventKind;
  incomingCapturedAt?: string;
  incomingContributorId?: string | null;
}): SourceConflictEvaluation {
  const incoming: ObservationSourceRef = {
    raw_text: params.incomingText,
    kind: params.incomingKind,
    captured_at: params.incomingCapturedAt ?? new Date().toISOString(),
    contributor_id: params.incomingContributorId ?? null,
  };
  const topic = detectTopic(incoming.raw_text);
  if (topic === "other") {
    return {
      has_conflict: false,
      priority_for_orientation: "neither",
      prior_text: null,
      incoming_text: null,
      note: null,
      pattern_label: null,
      open_ask: null,
      both_retained: true,
    };
  }

  const incomingPol = polarity(incoming.raw_text, topic);
  if (incomingPol === 0) {
    return {
      has_conflict: false,
      priority_for_orientation: "neither",
      prior_text: null,
      incoming_text: null,
      note: null,
      pattern_label: null,
      open_ask: null,
      both_retained: true,
    };
  }

  const priorPool: ObservationSourceRef[] = [
    ...(params.careKey ? listSourceClaims(params.careKey) : []),
    ...(params.priorObservations ?? []),
  ];

  for (const prior of [...priorPool].reverse()) {
    if (
      prior.raw_text.trim().toLowerCase() === incoming.raw_text.trim().toLowerCase()
    ) {
      continue;
    }
    if (detectTopic(prior.raw_text) !== topic) continue;
    const priorPol = polarity(prior.raw_text, topic);
    if (priorPol === 0 || priorPol === incomingPol) continue;
    const multi = multiContributorOppose(prior, incoming);
    if (!sourcesDiffer(prior, incoming) && !multi) continue;

    // A detected contradiction is not a vote. Source type, recency and
    // contributor count do not select a winner; preserve both and request review.
    const priority_for_orientation = "neither" as const;

    return {
      has_conflict: true,
      priority_for_orientation,
      prior_text: prior.raw_text,
      incoming_text: incoming.raw_text,
      note: multi
        ? "More than one contributor reported differently — both are held for review. Neither account is selected as correct."
        : "Sources do not fully agree — both are held for review. Neither account is selected as correct.",
      pattern_label: multi ? "disagreeing care views" : "source conflict",
      open_ask: multi
        ? "Both views stay in the record — what are you seeing now?"
        : "Which of these matches what you are seeing now?",
      both_retained: true,
    };
  }

  return {
    has_conflict: false,
    priority_for_orientation: "neither",
    prior_text: null,
    incoming_text: null,
    note: null,
    pattern_label: null,
    open_ask: null,
    both_retained: true,
  };
}
