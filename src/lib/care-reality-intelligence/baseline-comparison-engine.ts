/**
 * Baseline Comparison Engine — Architecture Directive #2.
 * Previous reality → new observation → difference → meaning → attention.
 *
 * SoT: docs/02-product/solenos-baseline-comparison-engine.md
 * MVP: reconstruct baseline from usual/used-to discourse + durable familiarity;
 * compare every capture; surface meaningful changes; never invent causation.
 *
 * Doc examples are illustrations only — never product if-branches on scenario nouns.
 */

import type { ActiveCareSituation } from "../active-care-situation/types";
import {
  listFamiliarityBaseline,
  observationCareFact,
  recordFamiliarityFromText,
} from "../care-epistemics";
import { resolveCareRealityStoreKey } from "../multi-caregiver-context-model";
import {
  looksLikeContributorLoadFragment,
  looksLikeDisagreementPerspectiveFragment,
} from "../care-reality-extraction/classify";

export const BASELINE_COMPARISON_PURPOSE =
  "Understand who this person was before, what is different now, and what that change means — never flat extraction.";

/** Internal domain labels — never expose as caregiver UI chrome. */
export type BaselineDomain =
  | "cognition"
  | "behavior"
  | "function"
  | "physical"
  | "medical"
  | "general";

/** Engine-only certainty — never percentages in caregiver UI. */
export type BaselineConfidence = "low" | "medium" | "high";

/**
 * Baseline_State — living comparison unit per domain / change thread.
 */
export type BaselineState = {
  person_id: string;
  domain: BaselineDomain;
  previous_state: string;
  current_observation: string | null;
  change_detected: boolean;
  date_change_noticed: string | null;
  related_events: string[];
  confidence: BaselineConfidence;
  unknowns: string[];
};

export type BaselineComparisonResult = {
  person: string | null;
  person_id: string;
  /** initial_assessment = no comparable prior; change_detection = prior held, stated, or ACS memory. */
  mode: "initial_assessment" | "change_detection";
  known_baseline: string[];
  /** Current-situation facts when in initial assessment (not framed as “changes”). */
  current_concerns: string[];
  known_facts: string[];
  states: BaselineState[];
  /** Caregiver-oriented meaningful change lines (not raw extraction dump). */
  meaningful_changes: string[];
  related_context: string[];
  unknowns: string[];
  has_baseline: boolean;
  /** True only in change_detection when a real prior→now difference is held. */
  has_meaningful_change: boolean;
  /** True when durable familiarity, same-turn usual/used-to, or held ACS/CRS prior observations exist. */
  has_comparable_prior: boolean;
  /** Contract marker — orientation must not invent diagnosis causation. */
  causation_forbidden: true;
};

const CAUSATION_THEATER =
  /\b(?:because (?:of )?(?:dementia|alzheimer)|dementia is progressing|getting worse because|caused by (?:the )?dementia)\b/i;

/** Structural habitual / usual cues — discourse, not clinical keyword banks. */
const BASELINE_CUE =
  /\b(?:used to|usually|normally|always|every (?:morning|evening|day|afternoon|night)|typical(?:ly)?|her normal|his normal|their normal)\b/i;

/** Contrast / change discourse — structural. */
const CHANGE_CUE =
  /\b(?:stopped|no longer|doesn'?t|does not|isn'?t|is not|for the past|over the (?:past|last)|lately|these days|anymore|but now|now|yesterday|today|this morning|has been|became|started|tried|keeps?|left (?:the )?(?:house|home)|won'?t|would not)\b/i;

/** Timing / event context around change — related, not proven cause. */
const RELATED_EVENT_CUE =
  /\b(?:hospital|discharg|medication|medicine|after (?:the |her |his )?|since|following|procedure|surgery|appointment|clinic)\b/i;

function splitClauses(text: string): string[] {
  const sentences = text
    .split(/(?<=[.!?])\s+|\n+|;\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 8);
  const out: string[] = [];
  for (const s of sentences) {
    const parts = s.split(
      /,\s*(?=he\b|she\b|they\b)|,\s*and\s+(?=after\b|then\b|also\b|he\b|she\b)|(?<![,])\s+and\s+(?=(?:yesterday|today|this morning|then|also|she|he|they|after)\b)/i,
    );
    if (parts.length >= 2 && parts.every((p) => p.trim().length >= 8)) {
      for (const p of parts) out.push(p.trim().replace(/^and\s+/i, ""));
    } else {
      out.push(s);
    }
  }
  return out;
}

/**
 * Prior held care memory on the ACS — all observations except the latest turn.
 * First capture (length ≤ 1) is not a comparable prior (still Initial Assessment).
 * Returning captures with held observations graduate out of Initial Assessment Mode.
 */
export function heldPriorCareMemoryFacts(
  situation: ActiveCareSituation,
): string[] {
  const obs = situation.observations ?? [];
  if (obs.length <= 1) return [];
  const facts: string[] = [];
  for (const o of obs.slice(0, -1)) {
    const fact = observationCareFact({
      human_fact: o.human_fact,
      raw_text: o.raw_text,
    });
    const line = (fact ?? o.human_fact ?? o.raw_text ?? "").replace(/\s+/g, " ").trim();
    if (line.length < 8) continue;
    if (isNonRecipientBaselineNoise(line)) continue;
    const clipped = line.slice(0, 160);
    if (!facts.some((f) => f.toLowerCase().slice(0, 40) === clipped.toLowerCase().slice(0, 40))) {
      facts.push(clipped.endsWith(".") ? clipped : `${clipped}.`);
    }
  }
  return facts.slice(0, 8);
}

/**
 * Prior held care memory on CRS — durable understanding / evidence from earlier turns.
 * First CRS revision (or single evidence line matching this capture) is not comparable prior.
 * Enables graduation when ACS is fresh but Care Reality State already holds the story.
 */
export function heldCrsCareMemoryFacts(params: {
  current_understanding?: string[] | null;
  supporting_evidence?: Array<{ observation: string }> | null;
  observation_count?: number | null;
  revision?: number | null;
  latestRawText?: string | null;
}): string[] {
  const revision = params.revision ?? 0;
  const obsCount = params.observation_count ?? 0;
  const evidence = params.supporting_evidence ?? [];
  const understanding = params.current_understanding ?? [];
  // Same-turn CRS write after first capture must not fake a prior.
  if (revision <= 1 && obsCount <= 1 && evidence.length <= 1 && understanding.length <= 1) {
    return [];
  }
  const latestNorm = (params.latestRawText ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, 48);
  const facts: string[] = [];
  const push = (raw: string) => {
    const line = raw.replace(/\s+/g, " ").trim();
    if (line.length < 8) return;
    if (isNonRecipientBaselineNoise(line)) return;
    if (
      latestNorm.length >= 12 &&
      line.toLowerCase().includes(latestNorm.slice(0, 36))
    ) {
      return;
    }
    const clipped = line.slice(0, 160);
    if (!facts.some((f) => f.toLowerCase().slice(0, 40) === clipped.toLowerCase().slice(0, 40))) {
      facts.push(clipped.endsWith(".") ? clipped : `${clipped}.`);
    }
  };
  // Prefer evidence from earlier turns when multiple are held.
  const priorEvidence =
    evidence.length > 1 ? evidence.slice(0, -1) : evidence;
  for (const e of priorEvidence) push(e.observation);
  for (const h of understanding) push(h);
  return facts.slice(0, 8);
}

function contentTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .filter(
      (w) =>
        ![
          "the",
          "and",
          "for",
          "with",
          "that",
          "this",
          "from",
          "have",
          "has",
          "had",
          "was",
          "were",
          "are",
          "been",
          "her",
          "his",
          "she",
          "him",
          "they",
          "them",
          "mom",
          "dad",
          "about",
          "used",
          "every",
          "past",
          "month",
          "because",
          "thought",
          "needed",
        ].includes(w),
    );
}

function tokenOverlap(a: string[], b: string[]): number {
  const setB = new Set(b);
  return a.filter((t) => setB.has(t)).length;
}

function inferDomain(text: string): BaselineDomain {
  const t = text.toLowerCase();
  if (/\b(?:medication|medicine|hospital|discharg|diagnos|procedure|surgery)\b/.test(t)) {
    return "medical";
  }
  if (
    /\b(?:remember|forgot|confused|confusion|recognized|recognis|asked who|know(?:s|ing)? (?:where|who)|routine)\b/.test(
      t,
    )
  ) {
    return "cognition";
  }
  if (
    /\b(?:cook|walk|mobility|dress|bathe|shower|personal care|independen|prepare|food|eat|eating|appetite|sleep|nap|energy)\b/.test(
      t,
    )
  ) {
    if (/\b(?:cook|walk|dress|bathe|shower|prepare|independen)\b/.test(t)) return "function";
    return "physical";
  }
  if (/\b(?:agitat|restless|calm|mood|evening|social|trigger)\b/.test(t)) {
    return "behavior";
  }
  return "general";
}

function isNonRecipientBaselineNoise(clause: string): boolean {
  return (
    looksLikeContributorLoadFragment(clause) ||
    looksLikeDisagreementPerspectiveFragment(clause)
  );
}

function isBaselineOnlyClause(clause: string): boolean {
  if (isNonRecipientBaselineNoise(clause)) return false;
  return BASELINE_CUE.test(clause);
}

function isChangeClause(clause: string): boolean {
  if (isNonRecipientBaselineNoise(clause)) return false;
  return CHANGE_CUE.test(clause);
}

function extractHabitualSpan(clause: string): string | null {
  if (!BASELINE_CUE.test(clause)) return null;
  const cut = clause.split(
    /\b(?:but now|but|now|anymore|these days|for the past|stopped|no longer)\b/i,
  )[0];
  const span = (cut ?? clause).trim().replace(/\s+/g, " ").slice(0, 160);
  return span.length >= 8 ? span : null;
}

function extractChangeSpan(clause: string): string | null {
  if (!isChangeClause(clause)) return null;
  return clause.trim().replace(/\s+/g, " ").slice(0, 180);
}

function extractTimingHint(text: string): string | null {
  const m = text.match(
    /\b(?:for the past|over the (?:past|last)|since|yesterday|today|this morning|lately|these days|two weeks|a month|weeks? ago|days? ago)[^.!?]{0,40}/i,
  );
  return m ? m[0]!.trim().slice(0, 80) : null;
}

function extractRelatedEvents(text: string): string[] {
  const out: string[] = [];
  for (const clause of splitClauses(text)) {
    if (RELATED_EVENT_CUE.test(clause)) {
      out.push(clause.replace(/\s+/g, " ").slice(0, 140));
    }
  }
  return out.slice(0, 3);
}

/**
 * Seed / reinforce living baseline from a capture that establishes usual patterns.
 * Uses care-epistemics durable familiarity — does not invent diagnosis identity.
 */
export function seedBaselineFromCapture(params: {
  careKey: string;
  rawText: string;
  subjectLabel: string;
  nowIso?: string;
}): string[] {
  const seeded: string[] = [];
  for (const clause of splitClauses(params.rawText)) {
    if (isNonRecipientBaselineNoise(clause)) continue;
    if (!isBaselineOnlyClause(clause)) continue;
    const habitual = extractHabitualSpan(clause);
    if (!habitual || isNonRecipientBaselineNoise(habitual)) continue;
    const facts = recordFamiliarityFromText({
      careKey: params.careKey,
      rawText: habitual,
      subjectLabel: params.subjectLabel,
      nowIso: params.nowIso,
    });
    for (const f of facts) {
      if (!seeded.includes(f.statement)) seeded.push(f.statement);
    }
  }
  return seeded;
}

/**
 * Compare latest capture against living baseline (same-turn discourse + durable familiarity).
 */
export function compareAgainstBaseline(params: {
  situation: ActiveCareSituation;
  latestRawText?: string;
  careKey?: string;
  person?: string | null;
  nowIso?: string;
  /** When true, seed baseline facts from this capture before comparing. */
  seedFromCapture?: boolean;
  /**
   * Optional CRS (or other durable) held facts — comparable prior even when ACS is a fresh session.
   * Same-turn-only CRS must not be passed as prior (see heldCrsCareMemoryFacts).
   */
  priorHeldFacts?: string[];
  /** Optional CRS fields — used when priorHeldFacts is omitted. */
  crs?: {
    current_understanding?: string[] | null;
    supporting_evidence?: Array<{ observation: string }> | null;
    observation_count?: number | null;
    revision?: number | null;
  } | null;
}): BaselineComparisonResult {
  const rawKey =
    params.careKey ??
    params.situation.care_recipient_id ??
    params.situation.caregiver_id;
  const person_id = resolveCareRealityStoreKey(rawKey);
  const person =
    params.person ??
    (params.situation.subject_label &&
    !/^(they|your loved one)$/i.test(params.situation.subject_label)
      ? params.situation.subject_label
      : null);
  const latest = params.latestRawText?.trim() ?? "";
  const subjectLabel = person ?? params.situation.subject_label ?? "they";

  if (params.seedFromCapture !== false && latest) {
    seedBaselineFromCapture({
      careKey: person_id,
      rawText: latest,
      subjectLabel,
      nowIso: params.nowIso,
    });
  }

  const durableFacts = listFamiliarityBaseline(person_id);
  const known_baseline: string[] = [];
  const states: BaselineState[] = [];
  const meaningful_changes: string[] = [];
  const current_concerns: string[] = [];
  const known_facts: string[] = [];
  const related_context = extractRelatedEvents(latest);
  const unknowns: string[] = [];

  const clauses = latest ? splitClauses(latest) : [];
  const baselineClauses: string[] = [];
  const changeClauses: string[] = [];

  for (const c of clauses) {
    if (isNonRecipientBaselineNoise(c)) continue;
    const habitual = extractHabitualSpan(c);
    if (habitual && BASELINE_CUE.test(c) && !isNonRecipientBaselineNoise(habitual)) {
      baselineClauses.push(habitual);
      if (
        !known_baseline.some((b) =>
          b.toLowerCase().includes(habitual.toLowerCase().slice(0, 24)),
        )
      ) {
        known_baseline.push(habitual.endsWith(".") ? habitual : `${habitual}.`);
      }
    }
    if (isChangeClause(c)) {
      const changeSpan = extractChangeSpan(c);
      if (changeSpan && !isNonRecipientBaselineNoise(changeSpan)) {
        changeClauses.push(changeSpan);
      }
    }
  }

  for (const f of durableFacts) {
    if (
      !known_baseline.some(
        (b) => b.toLowerCase().slice(0, 36) === f.statement.toLowerCase().slice(0, 36),
      )
    ) {
      known_baseline.push(f.statement);
    }
  }

  // Comparable prior =
  // - durable familiarity, OR
  // - same-turn stated usual/used-to, OR
  // - held ACS care memory from earlier turns, OR
  // - held CRS understanding/evidence from earlier turns (ACS may be a new session).
  // Still never invent decline without baseline discourse; mode only chooses assessment path.
  const heldAcsFacts = heldPriorCareMemoryFacts(params.situation);
  const heldCrsFacts =
    params.priorHeldFacts && params.priorHeldFacts.length > 0
      ? params.priorHeldFacts
          .map((f) => f.replace(/\s+/g, " ").trim())
          .filter((f) => f.length >= 8 && !isNonRecipientBaselineNoise(f))
          .slice(0, 8)
      : heldCrsCareMemoryFacts({
          current_understanding: params.crs?.current_understanding,
          supporting_evidence: params.crs?.supporting_evidence,
          observation_count: params.crs?.observation_count,
          revision: params.crs?.revision,
          latestRawText: latest,
        });
  const heldPriorFacts = [...heldAcsFacts];
  for (const f of heldCrsFacts) {
    if (
      !heldPriorFacts.some(
        (h) => h.toLowerCase().slice(0, 40) === f.toLowerCase().slice(0, 40),
      )
    ) {
      heldPriorFacts.push(f.endsWith(".") ? f : `${f}.`);
    }
  }
  const has_held_care_memory = heldPriorFacts.length > 0;
  const has_comparable_prior =
    durableFacts.length > 0 || baselineClauses.length > 0 || has_held_care_memory;
  const mode: "initial_assessment" | "change_detection" = has_comparable_prior
    ? "change_detection"
    : "initial_assessment";

  const timing = latest ? extractTimingHint(latest) : null;

  // Initial assessment: hold current concerns as situation, not as “changes from before”
  if (mode === "initial_assessment") {
    for (const c of changeClauses.length > 0 ? changeClauses : clauses) {
      const line = c.replace(/\s+/g, " ").slice(0, 160);
      if (line.length >= 8) {
        current_concerns.push(line.endsWith(".") ? line : `${line}.`);
      }
    }
    if (latest && current_concerns.length === 0 && latest.length >= 12) {
      current_concerns.push(latest.slice(0, 160).replace(/\.$/, "") + ".");
    }
    for (const c of current_concerns.slice(0, 4)) {
      known_facts.push(c);
    }
    if (related_context[0]) known_facts.push(related_context[0]!);

    unknowns.push("Whether this is different from the usual pattern");
    unknowns.push("When these concerns started");
    unknowns.push("What a normal day looked like before");

    const uniqInit = (arr: string[]) => {
      const out: string[] = [];
      for (const x of arr) {
        if (!out.some((y) => y.toLowerCase() === x.toLowerCase())) out.push(x);
      }
      return out;
    };

    return {
      person,
      person_id,
      mode,
      known_baseline: uniqInit(known_baseline).slice(0, 8),
      current_concerns: uniqInit(current_concerns).slice(0, 4),
      known_facts: uniqInit(known_facts).slice(0, 4),
      states: [],
      meaningful_changes: [],
      related_context: uniqInit(related_context).slice(0, 3),
      unknowns: uniqInit(unknowns).slice(0, 4),
      has_baseline: false,
      has_meaningful_change: false,
      has_comparable_prior: false,
      causation_forbidden: true,
    };
  }

  const usedBaseline = new Set<string>();
  for (const change of changeClauses) {
    const changeTokens = contentTokens(change);
    const changeDomain = inferDomain(change);

    let previous: string | null = null;
    let bestScore = 0;
    for (const b of [...baselineClauses, ...durableFacts.map((f) => f.statement)]) {
      if (isNonRecipientBaselineNoise(b)) continue;
      const score = tokenOverlap(contentTokens(b), changeTokens);
      const domainBoost = inferDomain(b) === changeDomain ? 1 : 0;
      const total = score + domainBoost;
      if (total > bestScore && !usedBaseline.has(b.toLowerCase().slice(0, 40))) {
        bestScore = total;
        previous = b;
      }
    }
    if (previous && isNonRecipientBaselineNoise(previous)) previous = null;
    if (!previous && baselineClauses[0] && !isNonRecipientBaselineNoise(baselineClauses[0]!)) {
      previous = baselineClauses[0]!;
    }
    if (
      !previous &&
      known_baseline[0] &&
      !isNonRecipientBaselineNoise(known_baseline[0]!)
    ) {
      previous = known_baseline[0]!;
    }

    if (!previous && durableFacts.length === 0 && baselineClauses.length === 0) {
      continue;
    }

    if (previous) usedBaseline.add(previous.toLowerCase().slice(0, 40));

    const change_detected = Boolean(previous) || bestScore >= 1;
    if (!change_detected && !CHANGE_CUE.test(change)) continue;

    const state: BaselineState = {
      person_id,
      domain: changeDomain,
      previous_state: previous ?? "Previous usual pattern (not fully stated).",
      current_observation: change,
      change_detected: true,
      date_change_noticed: timing,
      related_events: related_context.slice(0, 2),
      confidence: previous && bestScore >= 1 ? "medium" : "low",
      unknowns: [],
    };
    states.push(state);

    const cessation =
      /\b(?:stopped|no longer|doesn'?t|does not|isn'?t|won'?t)\b/i.test(change) &&
      previous &&
      BASELINE_CUE.test(previous);
    const safetyLeave =
      /\b(?:left (?:the )?(?:house|home)|trying to leave|tried to leave|keeps? trying to leave)\b/i.test(
        change,
      );

    if (cessation && previous) {
      meaningful_changes.push(
        `Loss of a familiar pattern: previously ${previous
          .replace(/\.$/, "")
          .replace(/^mom\s+/i, "")
          .replace(/^she\s+/i, "")} — now ${change
          .replace(/\.$/, "")
          .replace(/^mom\s+/i, "")
          .replace(/^she\s+/i, "")}.`,
      );
    } else if (safetyLeave) {
      meaningful_changes.push(
        `Safety-related behavior change: ${change.replace(/\.$/, "")}.`,
      );
    } else if (previous) {
      meaningful_changes.push(
        `Different from previous pattern (${previous.replace(/\.$/, "")}): ${change.replace(/\.$/, "")}.`,
      );
    } else {
      meaningful_changes.push(change.endsWith(".") ? change : `${change}.`);
    }
  }

  if (
    meaningful_changes.length === 0 &&
    durableFacts.length > 0 &&
    latest &&
    CHANGE_CUE.test(latest) &&
    !BASELINE_CUE.test(latest)
  ) {
    const prior = durableFacts[durableFacts.length - 1]!;
    meaningful_changes.push(
      `Different from the usual pattern held earlier (${prior.statement.replace(/\.$/, "")}): ${latest.slice(0, 140).replace(/\.$/, "")}.`,
    );
    states.push({
      person_id,
      domain: inferDomain(latest),
      previous_state: prior.statement,
      current_observation: latest.slice(0, 180),
      change_detected: true,
      date_change_noticed: timing,
      related_events: related_context.slice(0, 2),
      confidence: "medium",
      unknowns: [],
    });
  }

  // Returning Care Reality with held ACS memory but no formal usual/used-to baseline yet:
  // treat new capture as related update — never invent decline / "new behavior" theater.
  // Do not embed long near-raw prior/latest blobs (echo theater).
  if (
    meaningful_changes.length === 0 &&
    heldPriorFacts.length > 0 &&
    latest
  ) {
    const priorFocus = heldPriorFacts[heldPriorFacts.length - 1]!.replace(/\.$/, "");
    const latestFocus = (
      changeClauses[0] ??
      clauses.find((c) => !isNonRecipientBaselineNoise(c)) ??
      latest
    )
      .replace(/\s+/g, " ")
      .slice(0, 140)
      .replace(/\.$/, "");
    if (
      latestFocus.length >= 8 &&
      !priorFocus.toLowerCase().includes(latestFocus.toLowerCase().slice(0, 36))
    ) {
      meaningful_changes.push(
        "Related update to what was already held — new details connect to the care situation already underway.",
      );
      states.push({
        person_id,
        domain: inferDomain(latestFocus),
        previous_state: priorFocus.slice(0, 160),
        current_observation: latestFocus.slice(0, 180),
        change_detected: true,
        date_change_noticed: timing,
        related_events: related_context.slice(0, 2),
        confidence: "low",
        unknowns: [
          "Whether this is different from the usual pattern",
          "When these concerns started",
        ],
      });
      for (const u of [
        "Whether this is different from the usual pattern",
        "When these concerns started",
      ]) {
        if (!unknowns.includes(u)) unknowns.push(u);
      }
      for (const f of heldPriorFacts.slice(0, 3)) {
        if (
          !known_baseline.some(
            (b) => b.toLowerCase().slice(0, 36) === f.toLowerCase().slice(0, 36),
          )
        ) {
          known_baseline.push(f);
        }
      }
    }
  }

  const has_baseline = known_baseline.length > 0 || durableFacts.length > 0;
  const has_meaningful_change = meaningful_changes.length > 0;

  if (has_meaningful_change) {
    unknowns.push("When these changes first started");
    if (meaningful_changes.length >= 2) {
      unknowns.push("Whether both changes appeared around the same time");
    }
    unknowns.push(
      "Whether there were medical or environmental changes before this began",
    );
  }

  const uniq = (arr: string[]) => {
    const out: string[] = [];
    for (const x of arr) {
      if (!out.some((y) => y.toLowerCase() === x.toLowerCase())) out.push(x);
    }
    return out;
  };

  return {
    person,
    person_id,
    mode: "change_detection",
    known_baseline: uniq(known_baseline).slice(0, 8),
    current_concerns: [],
    known_facts: uniq(known_baseline).slice(0, 4),
    states: states.slice(0, 6),
    meaningful_changes: uniq(meaningful_changes).slice(0, 4),
    related_context: uniq(related_context).slice(0, 3),
    unknowns: uniq(unknowns).slice(0, 4),
    has_baseline,
    has_meaningful_change,
    has_comparable_prior: true,
    causation_forbidden: true,
  };
}

/**
 * Caregiver orientation from baseline comparison — never causation theater.
 */
export function orientationFromBaselineComparison(
  comparison: BaselineComparisonResult,
): {
  current_understanding: string | null;
  what_changed: string | null;
  still_unclear: string[];
} {
  const who = comparison.person && comparison.person !== "they" ? comparison.person : null;
  const whose = who ? `${who}'s` : "their";

  if (!comparison.has_meaningful_change) {
    if (comparison.has_baseline && comparison.known_baseline[0]) {
      return {
        current_understanding: `A usual pattern for ${who ?? "them"} is held: ${comparison.known_baseline[0].replace(/\.$/, "")}.`,
        what_changed: null,
        still_unclear: [],
      };
    }
    return { current_understanding: null, what_changed: null, still_unclear: [] };
  }

  const n = comparison.meaningful_changes.length;
  let current_understanding: string;
  if (n >= 2) {
    current_understanding = `Two changes from ${whose} previous routine have appeared:\n\n1. ${comparison.meaningful_changes[0]!.replace(/\.$/, "")}.\n\n2. ${comparison.meaningful_changes[1]!.replace(/\.$/, "")}.\n\nThese changes suggest a shift from ${whose} previous pattern.`;
  } else {
    const change = comparison.meaningful_changes[0]!.replace(/\.$/, "");
    // Held-memory related update (no formal usual/used-to) — continue the story, never invent "decline from usual".
    if (/^Related update to what was already held/i.test(change)) {
      current_understanding = who
        ? `${change}. This stays with ${who}'s care situation already underway — not a separate story.`
        : `${change}. This stays with the care situation already underway — not a separate story.`;
    } else {
      const prior = comparison.known_baseline[0]
        ? comparison.known_baseline[0].replace(/\.$/, "")
        : "the previous usual pattern";
      current_understanding = `${change}. This differs from ${whose} previous pattern (${prior}).`;
    }
  }

  if (CAUSATION_THEATER.test(current_understanding)) {
    current_understanding = current_understanding.replace(
      CAUSATION_THEATER,
      "for reasons that are not yet clear",
    );
  }

  const what_changed =
    n >= 2
      ? comparison.meaningful_changes.map((c) => c.replace(/\.$/, "")).join("; ") + "."
      : comparison.meaningful_changes[0] ?? null;

  return {
    current_understanding,
    what_changed,
    still_unclear: comparison.unknowns.slice(0, 3),
  };
}

/** True when caregiver-facing text invents dementia/diagnosis causation. */
export function inventsBaselineCausation(blob: string): boolean {
  return CAUSATION_THEATER.test(blob);
}

/** True when response is flat extraction without baseline comparison language. */
export function isFlatExtractionWithoutBaseline(params: {
  blob: string;
  hasMeaningfulChange: boolean;
}): boolean {
  if (!params.hasMeaningfulChange) return false;
  const b = params.blob.toLowerCase();
  const hasChangeLanguage =
    /\b(?:previous|usual|used to|before|different from|shift from|familiar pattern|previous routine|previous pattern)\b/i.test(
      b,
    );
  return !hasChangeLanguage;
}
