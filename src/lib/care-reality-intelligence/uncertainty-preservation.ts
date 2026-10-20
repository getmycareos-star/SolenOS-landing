/**
 * Uncertainty Preservation Engine — separate what happened from why.
 * Never Observation→Diagnosis or Correlation→Cause.
 *
 * SoT: docs/02-product/solenos-uncertainty-preservation.md
 * Doc examples are illustrations only — never product if-branches on scenario nouns.
 */

export const UNCERTAINTY_PRESERVATION_PURPOSE =
  "Preserve uncertainty: hold what happened and what may be connected — never invent why.";

/** Engine-only certainty — never % in caregiver UI. */
export type UncertaintyConfidenceBand = "low" | "medium" | "high";

export type UncertaintyKnownFact = {
  what_happened: string;
  when_note: string | null;
  source: "caregiver_report" | "document" | "prior_record";
  /** Direct observation confidence — often high when caregiver reported. */
  observation_confidence: UncertaintyConfidenceBand;
  observation_reason: string;
};

export type UncertaintyPossibleLink = {
  summary: string;
  /** Cause/explanation confidence — usually low until evidence supports. */
  cause_confidence: UncertaintyConfidenceBand;
  cause_reason: string;
};

export type UncertaintyPreservationModel = {
  known: UncertaintyKnownFact[];
  possible_relationships: UncertaintyPossibleLink[];
  unknowns: string[];
  /** Caregiver-facing blocks — human language only. */
  what_we_know: string[];
  what_may_be_connected: string[];
  what_remains_unclear: string[];
  /** Orientation line that preserves uncertainty (never causal theater). */
  human_orientation: string | null;
  /** Engine: observation confidence for primary held change. */
  primary_observation_confidence: UncertaintyConfidenceBand;
  /** Engine: cause confidence — low unless supported. */
  primary_cause_confidence: UncertaintyConfidenceBand;
};

/** Causal / diagnosis theater — reject in caregiver-facing output. */
export const CAUSAL_THEATER_PATTERNS = [
  /\bthe medication (?:is |was )?(?:causing|caused)\b/i,
  /\bmedication caused\b/i,
  /\bcaused (?:by|the) (?:the )?(?:medication|medicine|dementia|alzheimer)\b/i,
  /\bis causing (?:the )?(?:increased |more )?(?:sleep|confusion|aggression)\b/i,
  /\bthis is (?:dementia|alzheimer(?:'?s)?) progression\b/i,
  /\bdementia is progressing\b/i,
  /\bbecause of (?:the )?(?:medication|dementia|alzheimer)\b/i,
  /\bdefinitely (?:caused|due to|from the medication)\b/i,
  /\bwe know (?:for (?:certain|sure)|exactly) (?:that )?(?:the )?cause\b/i,
  /\bside effect of (?:the )?(?:medication|medicine)\b/i,
  /\bmust be (?:caused by|due to|a side effect)\b/i,
] as const;

export function containsCausalTheater(blob: string): boolean {
  return CAUSAL_THEATER_PATTERNS.some((p) => p.test(blob));
}

/**
 * Engineering rule: never treat a stored “conclusion” string as a fact.
 */
export function isStoredConclusionAsFact(text: string): boolean {
  return (
    /\b(?:medication|medicine) (?:caused|is causing)\b/i.test(text) ||
    /\bcaused (?:the )?(?:confusion|sleep|aggression|decline)\b/i.test(text) ||
    /\bis (?:dementia|alzheimer) progression\b/i.test(text)
  );
}

function hasSleepChange(t: string): boolean {
  return /\b(?:sleep(?:s|ing)? more|sleep(?:s|ing)? less|sleeping much more|increased sleep|more tired|seems more tired)\b/i.test(
    t,
  );
}

function hasConfusionChange(t: string): boolean {
  return /\b(?:confused|confusion|became more confused|more confused|forgetting|forget)\b/i.test(
    t,
  );
}

function hasBehaviorChange(t: string): boolean {
  return /\b(?:aggressive|aggression|agitated|upset|withdrawn|personality)\b/i.test(
    t,
  );
}

function hasMedicationChange(t: string): boolean {
  return (
    /\b(?:medication|medicine|dose|pill)\b/i.test(t) &&
    /\b(?:changed|change|stopped|started|new|adjusted)\b/i.test(t)
  );
}

function hasHospitalEvent(t: string): boolean {
  return /\b(?:hospital|discharg|leaving the hospital|left the hospital)\b/i.test(
    t,
  );
}

function timingSuggestsLink(t: string): boolean {
  return /\b(?:since|after|around the same|following|when .{0,30}changed)\b/i.test(
    t,
  );
}

/**
 * Build Known / Possible / Unknown from caregiver text.
 * Does not invent diagnosis or medication side effects as fact.
 */
export function preserveUncertainty(params: {
  rawText: string;
  careRecipient?: string | null;
}): UncertaintyPreservationModel {
  const t = params.rawText.trim();
  const who =
    params.careRecipient && params.careRecipient !== "they"
      ? params.careRecipient
      : null;
  const known: UncertaintyKnownFact[] = [];
  const possible_relationships: UncertaintyPossibleLink[] = [];
  const unknowns: string[] = [];

  if (!t) {
    return emptyModel();
  }

  if (hasSleepChange(t)) {
    known.push({
      what_happened: who
        ? `${who} is sleeping more than usual (as reported).`
        : "Sleeping more than usual (as reported).",
      when_note: timingSuggestsLink(t)
        ? "Around the same period as other held care events."
        : null,
      source: "caregiver_report",
      observation_confidence: "high",
      observation_reason: "Caregiver directly reported this.",
    });
  }

  if (hasConfusionChange(t)) {
    known.push({
      what_happened: who
        ? `${who}'s confusion or memory change was reported.`
        : "Confusion or memory change was reported.",
      when_note: timingSuggestsLink(t)
        ? "Timing relates to nearby care events — cause not established."
        : null,
      source: "caregiver_report",
      observation_confidence: "high",
      observation_reason: "Caregiver directly reported this.",
    });
  }

  if (hasBehaviorChange(t)) {
    known.push({
      what_happened: who
        ? `A change in ${who}'s behavior was noticed.`
        : "A change in behavior was noticed.",
      when_note: null,
      source: "caregiver_report",
      observation_confidence: "high",
      observation_reason: "Caregiver directly reported this.",
    });
  }

  if (hasMedicationChange(t)) {
    known.push({
      what_happened: "A medication change occurred (as reported).",
      when_note: timingSuggestsLink(t)
        ? "Held near other reported changes in time."
        : null,
      source: "caregiver_report",
      observation_confidence: "high",
      observation_reason: "Caregiver directly reported this.",
    });
  }

  if (hasHospitalEvent(t)) {
    known.push({
      what_happened: "A hospital-related event occurred (as reported).",
      when_note: /\bbefore|after|since leaving|since\b/i.test(t)
        ? "Held in sequence with later changes — relationship possible."
        : null,
      source: "caregiver_report",
      observation_confidence: "high",
      observation_reason: "Caregiver directly reported this.",
    });
  }

  // Possible relationships — never stored as causes
  if (hasMedicationChange(t) && (hasSleepChange(t) || hasConfusionChange(t))) {
    possible_relationships.push({
      summary:
        "A medication change may be related to the reported change — timing suggests a possible relationship, not a proven cause.",
      cause_confidence: "low",
      cause_reason:
        "Timing suggests a possible relationship, but cause is unknown.",
    });
  }

  if (hasHospitalEvent(t) && (hasSleepChange(t) || hasConfusionChange(t))) {
    possible_relationships.push({
      summary:
        "Recovery or other factors after a hospital event may be related — cause unclear.",
      cause_confidence: "low",
      cause_reason: "Sequence is held; explanation is not established.",
    });
  }

  if (hasBehaviorChange(t)) {
    possible_relationships.push({
      summary:
        "Possible factors can include changes in health, environment, routine, or medication — more context is needed.",
      cause_confidence: "low",
      cause_reason: "Behavior change alone does not establish a cause.",
    });
  }

  if (possible_relationships.length === 0 && known.length >= 2) {
    possible_relationships.push({
      summary:
        "Held care moments occurred near each other — relationship possible; cause unknown.",
      cause_confidence: "low",
      cause_reason: "Co-occurrence is not causation.",
    });
  }

  // Unknowns — what would improve understanding
  if (hasMedicationChange(t)) {
    unknowns.push("Which medication changed?");
    unknowns.push("Why was the medication changed?");
  }
  if (hasMedicationChange(t) && (hasSleepChange(t) || hasConfusionChange(t))) {
    unknowns.push(
      "Did the reported change begin before or after the medication change?",
    );
    unknowns.push("Did the clinician expect this effect?");
  }
  if (hasHospitalEvent(t) && hasSleepChange(t)) {
    if (!unknowns.some((u) => /before or after/i.test(u))) {
      unknowns.push(
        "How sleep compared before the hospital event versus after.",
      );
    }
  }
  if (hasBehaviorChange(t) && unknowns.length < 2) {
    unknowns.push("What else changed around the same time?");
  }
  if (known.length >= 1 && unknowns.length === 0) {
    unknowns.push("What would most improve understanding of this change?");
  }

  const what_we_know = known.map((k) => k.what_happened);
  const what_may_be_connected = possible_relationships.map((p) => p.summary);
  const what_remains_unclear = unknowns.slice(0, 4);

  const human_orientation = buildUncertaintyOrientation({
    who,
    known,
    possible_relationships,
    unknowns: what_remains_unclear,
    rawText: t,
  });

  return {
    known,
    possible_relationships,
    unknowns: what_remains_unclear,
    what_we_know,
    what_may_be_connected,
    what_remains_unclear,
    human_orientation,
    primary_observation_confidence:
      known.length > 0 ? "high" : "low",
    primary_cause_confidence: "low",
  };
}

function emptyModel(): UncertaintyPreservationModel {
  return {
    known: [],
    possible_relationships: [],
    unknowns: [],
    what_we_know: [],
    what_may_be_connected: [],
    what_remains_unclear: [],
    human_orientation: null,
    primary_observation_confidence: "low",
    primary_cause_confidence: "low",
  };
}

function buildUncertaintyOrientation(params: {
  who: string | null;
  known: UncertaintyKnownFact[];
  possible_relationships: UncertaintyPossibleLink[];
  unknowns: string[];
  rawText: string;
}): string | null {
  const { who, known, possible_relationships, unknowns, rawText: t } = params;
  if (known.length === 0) return null;

  const sleep = hasSleepChange(t);
  const confusion = hasConfusionChange(t);
  const med = hasMedicationChange(t);
  const hospital = hasHospitalEvent(t);
  const behavior = hasBehaviorChange(t);

  // Acceptance-shaped orientations — structural, not scenario hardcoding of names
  if (confusion && med) {
    const subject = who ? `${who}'s confusion` : "Confusion";
    return `${subject} increased after a medication change. These events occurred around the same period, but the reason remains unclear. Understanding which medication changed and why may help clarify what happened.`;
  }

  if (sleep && med) {
    const subject = who ? `${who}'s increased sleeping` : "Increased sleeping";
    return `${subject} happened around the same time as a medication change. A relationship is possible, not proven. It may be useful to understand what medication changed and why.`;
  }

  if (sleep && hospital) {
    const subject = who ? `${who}'s increased sleeping` : "Increased sleeping";
    return `${subject} happened around the same period as a hospital-related event${med ? " and a medication change" : ""}. These may be related — the cause is still unclear.`;
  }

  if (behavior && !med) {
    return `A change in behavior has been noticed. Possible factors can include changes in health, environment, routine, or medication. More context is needed before the cause is clear.`;
  }

  if (possible_relationships.length > 0 && known.length >= 2) {
    const facts = known
      .slice(0, 3)
      .map((k) => k.what_happened.replace(/\s*\(as reported\)\.?$/i, ""))
      .join(" ");
    const ask = unknowns[0]
      ? ` ${unknowns[0].replace(/\?$/, "")} remains unclear.`
      : " The reason remains unclear.";
    return `${facts} Events appear around the same period; a relationship is possible, not proven.${ask}`;
  }

  return known[0]?.what_happened ?? null;
}

/**
 * Prefer uncertainty-preserving orientation when timing + change + possible cause cues exist.
 * Do not override a richer multi-category clinical orientation with a thin single-fact line.
 */
export function preferUncertaintyOrientation(params: {
  model: UncertaintyPreservationModel;
  fallback: string | null;
}): string | null {
  const human = params.model.human_orientation;
  if (!human) return params.fallback;
  if (containsCausalTheater(human)) return params.fallback;

  // Keep richer clinical / situation orientation when it already holds multi-change language
  if (
    params.fallback &&
    /\bseveral changes|around the same|biggest changes\b/i.test(params.fallback) &&
    params.fallback.length > human.length + 40
  ) {
    return params.fallback;
  }

  // Prefer when we hold possible links or multiple known facts
  if (
    params.model.possible_relationships.length > 0 ||
    params.model.known.length >= 2
  ) {
    return human;
  }
  return params.fallback ?? human;
}

/**
 * Validate caregiver-facing blob preserves uncertainty (hard gate helper).
 */
export function validateUncertaintyPreservation(params: {
  responseBlob: string;
  model?: UncertaintyPreservationModel | null;
  /** When true, also require uncertainty language if model held unknowns + links. */
  requireUncertaintyLanguage?: boolean;
}): {
  ok: boolean;
  failures: string[];
} {
  const failures: string[] = [];
  if (containsCausalTheater(params.responseBlob)) {
    failures.push("causal_theater");
  }
  if (isStoredConclusionAsFact(params.responseBlob)) {
    failures.push("conclusion_as_fact");
  }
  // Rich timing captures should not omit uncertainty language when checking orientation text
  if (
    params.requireUncertaintyLanguage &&
    params.model &&
    params.model.what_remains_unclear.length > 0 &&
    params.model.possible_relationships.length > 0 &&
    !/\b(?:unclear|may (?:be )?related|around the same|possible|not (?:yet )?(?:clear|proven|established)|more context|which medication|why)\b/i.test(
      params.responseBlob,
    )
  ) {
    failures.push("uncertainty_stripped");
  }
  return { ok: failures.length === 0, failures };
}

export function assertUncertaintyPreservation(params: {
  responseBlob: string;
  model?: UncertaintyPreservationModel | null;
  requireUncertaintyLanguage?: boolean;
}): void {
  const result = validateUncertaintyPreservation(params);
  if (!result.ok) {
    throw new Error(
      `Uncertainty preservation failed: ${result.failures.join(", ")} — never convert correlation into cause`,
    );
  }
}
