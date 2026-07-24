/**
 * Care Epistemics — principle-based understanding (not illustration keywords).
 *
 * Golden scenarios illustrate *behavior*. Product logic must work for any
 * caregiver language that fits the principle — never hardcode scenario nouns
 * as SolenOS product rules.
 *
 * Principles:
 * - G34: Person-told usual → store; later change vs *their* usual
 * - G37: Judgment without concrete observation → experience, not fact
 * - G40: Distinct care-signal clusters accumulate → gradual change before crisis
 * - G41: Identity/preference stop vs stored past self → life change
 * - G43: Harder day then clearer day → fluctuation, not disease “improved”
 * - G45: Change noted without cause → keep cause unknown
 * - G46: Contained change vs elevated safety concern — not constant alarms
 * - G47: Recurring safety-area evidence links later related notes
 * - G48: Stored preference recalled when related context returns (token overlap)
 * - G50: Missed care timing language — help manage, never blame
 * - G51: Disagreeing views held — never choose sides
 * - G54: Everyday language is enough — no medical vocabulary required
 * - G55: Continuity worry → orient from held reality, never diagnose or empty reassure
 */

import {
  livingCareRecordDataDir,
  readDurableJson,
  sanitizeDurableCareKey,
  writeDurableJson,
  clearDurableDirectory,
} from "../living-care-record-persistence/fs-store";
import { resolveCareRealityStoreKey } from "../multi-caregiver-context-model";

/**
 * G34/G40 store keys follow Care Reality (recipient), not contributor id.
 * Accept either contributor or care_recipient_id — never miss person-told usual.
 */
function resolveEpistemicCareKey(careKey: string): string {
  return resolveCareRealityStoreKey(careKey);
}

export type EpistemicClaimKind =
  | "caregiver_interpretation"
  | "observable_observation"
  | "baseline_establishment"
  | "mixed";

export type FamiliarityDomain =
  | "sleep"
  | "routine"
  | "communication"
  | "appetite"
  | "mobility"
  | "mood"
  | "preference"
  | "general";

export type FamiliarityBaselineFact = {
  id: string;
  care_key: string;
  domain: FamiliarityDomain;
  statement: string;
  source_text: string;
  established_at: string;
  /** Content tokens for overlap matching — not a keyword product list. */
  content_tokens: string[];
};

/** Structural signal families — categories of *what kind of event*, not scenario nouns. */
export type CareSignalFamily =
  | "missed_obligation"
  | "unattended_hazard"
  | "needed_assistance"
  | "wayfinding_difficulty"
  | "misplaced_belonging"
  | "communication_shift"
  | "other_observable";

export type CareSignal = {
  id: string;
  care_key: string;
  family: CareSignalFamily;
  source_text: string;
  content_tokens: string[];
  recorded_at: string;
};

const STOPWORDS = new Set([
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
  "being",
  "her",
  "his",
  "she",
  "him",
  "they",
  "them",
  "their",
  "mom",
  "dad",
  "about",
  "into",
  "just",
  "very",
  "more",
  "than",
  "when",
  "what",
  "which",
  "would",
  "could",
  "should",
  "today",
  "yesterday",
  "lately",
  "again",
  "also",
  "some",
  "said",
  "says",
  "want",
  "wants",
  "wanted",
]);

/** Content tokens for overlap — principle matching across any topic. */
export function contentTokens(text: string): string[] {
  return [
    ...new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 3 && !STOPWORDS.has(w)),
    ),
  ];
}

export function tokenOverlapCount(a: readonly string[], b: readonly string[]): number {
  let n = 0;
  for (const tb of b) {
    for (const ta of a) {
      if (ta === tb) {
        n += 1;
        break;
      }
      // Light stem match so singular/plural and -ing forms still overlap
      if (ta.length >= 4 && tb.length >= 4 && (ta.startsWith(tb) || tb.startsWith(ta))) {
        n += 1;
        break;
      }
    }
  }
  return n;
}

function subjectWho(subject: string): { who: string; possessive: string; they: boolean } {
  if (subject === "Mom" || subject === "Dad" || subject === "Grandma" || subject === "Grandpa") {
    return { who: subject, possessive: `${subject}'s`, they: false };
  }
  if (subject !== "Your loved one" && subject !== "they" && subject.trim()) {
    return { who: subject, possessive: `${subject}'s`, they: false };
  }
  return { who: "They", possessive: "their", they: true };
}

// ——— Structural claim typing (G37 / G34) ———

/** Evaluative judgment without a concrete observed action. */
function looksLikeInterpretation(text: string): boolean {
  const t = text.trim();
  // Character/behavior judgment adjectives or phrases
  const judgment =
    /\b(difficult|stubborn|combative|lazy|mean|impossible|out of character|acting (?:up|out)|won't cooperate|hard to deal with|personality (?:change|changed)|not (?:quite )?(?:her|him|them)self)\b/i.test(
      t,
    );
  if (!judgment) return false;
  // If the same note already names a concrete action/event, treat as mixed/observable
  if (looksLikeConcreteObservation(t)) return false;
  return true;
}

/** Concrete observation structure — something that happened / was done / refused. */
export function looksLikeConcreteObservation(text: string): boolean {
  const t = text.trim();
  // Messy typing: "herefusedto" still counts as refusal structure (not a topic keyword product rule).
  if (/refus\w*/i.test(t)) return true;
  return (
    /\b(wouldn't|would not|won't|could not|couldn't|needed help|forgot|missed|left .{0,24} (?:on|open|running)|got lost|couldn't find|threw|hit|yell\w*|upset during|during .{0,20}|took|didn't take|did not take)\b/i.test(
      t,
    ) ||
    // Hard event structure (something happened) — not a topic-quiz product rule
    /\b(fell|fallen|fall|collapsed|slipped)\b/i.test(t) ||
    /\b(this morning|yesterday|last night|this afternoon|an hour ago|today at)\b/i.test(t) ||
    // Care status + person report (structural illness mention, not a disease FAQ)
    /\b(is|are|was|been|got)\s+(sick|ill|unwell)\b/i.test(t)
  );
}

/**
 * Soft vague mood / confusion without a concrete care observation —
 * hold + facts only; do not dump Clarity (G1).
 */
export function isSoftVagueMoodNote(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (looksLikeConcreteObservation(t)) return false;
  // Stem forms (frustrat*/confus*) — trailing \b after the stem would miss "frustrated"/"confused".
  return /\b(not feeling well|hasn'?t been feeling well|haven'?t been feeling well|feeling (?:off|down|bad)|sad|upset|frustrat\w*|confus\w*|anxious|quiet|lonely|scared|worried|im confused|i'?m confused|isn'?t (?:her|him|them)self)\b/i.test(
    t,
  );
}

/**
 * True when held content can support light Clarity orientation (any topic).
 * Principle from illustrations — not fall/eat phrase templates.
 */
export function hasOrientableCareContent(text: string): boolean {
  const t = text.trim();
  if (t.length < 10) return false;
  if (isProductSessionMetaText(t)) return false;
  if (isSoftVagueMoodNote(t)) return false;
  if (looksLikeConcreteObservation(t)) return true;
  // Person + observed behavior (structural — not scenario noun templates)
  if (
    /\b(mom|dad|she|he|they|her|his)\b.{0,80}\b(talk(?:s|ing)?|speak(?:s|ing)?|say(?:s|ing)?|ask(?:s|ing)?|walk(?:s|ing)?|stay(?:s|ed|ing)?|sit(?:s|ting)?|sleep(?:s|ing)?|refus\w*|forgot|yell\w*|cry(?:ing)?|wander\w*|mumble[sd]?)\b/i.test(
      t,
    )
  ) {
    return true;
  }
  if (/\bkeeps?\s+(?:say(?:ing)?|ask(?:ing)?|repeat(?:ing)?)\b/i.test(t)) {
    return true;
  }
  if (/\b(talk(?:s|ing)?|speak(?:s|ing)?|mumble[sd]?)\s+to\s+(him|her|them)self\b/i.test(t)) {
    return true;
  }
  // Person + repeated questions / confusion reports (structural)
  if (
    /\b(mom|dad|she|he|they)\b.{0,80}\b(question|questions|repeat(?:s|ed|ing)?|confused|confus\w*)\b/i.test(
      t,
    )
  ) {
    return true;
  }
  // Compound person-care report (e.g. greeting + dad/mom + what is happening).
  // Commas/semicolons are not word chars — do not wrap them in \b (breaks ", " notes).
  const aboutPerson = /\b(mom|dad|she|he|they|her|his|their)\b/i.test(t);
  const compound = /(?:\band\b|[,;])/.test(t) && t.split(/\s+/).length >= 6;
  return aboutPerson && compound;
}

/**
 * Product / session chat about SolenOS — not care reality about a person.
 * Illustrations in docs are fixtures only; this is structural product-meta detection.
 */
export function isProductSessionMetaText(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (/^(hi|hello|hey)[,.]?\s*$/i.test(t)) return true;
  if (/^(hi|hello|hey)[,.]?\s+solenos\b/i.test(t)) return true;
  // Addresses SolenOS as product/assistant without a person care observation
  if (/\bsolenos\b/i.test(t)) {
    const aboutProduct =
      /\b(help(?:\s+me)?|recommend(?:ed)?|first time|how (?:do|does|can) (?:you|this)|what (?:are|is|do) you|using (?:you|this|the app))\b/i.test(
        t,
      );
    if (aboutProduct) {
      const withoutProduct = t.replace(/\bsolenos\b/gi, " ");
      if (
        !looksLikeConcreteObservation(withoutProduct) &&
        !/\b(mom|dad|she|he|they)\b.{0,40}\b(fell|eat|sleep|refus|ask|walk|talk|stay|sit)\b/i.test(
          withoutProduct,
        )
      ) {
        return true;
      }
    }
  }
  // First-time / discovery pitch with no person care signal
  if (
    /\bfirst time (?:here|using|trying|on)\b/i.test(t) &&
    !looksLikeConcreteObservation(t) &&
    !/\b(mom|dad|she|he|fell|medication|sleep|confused|refus)\b/i.test(t)
  ) {
    return true;
  }
  return false;
}

export type CareRealityAnchorOptions = {
  /**
   * Prior ACS care facts — thin follow-ups without a person pronoun may still
   * count as care-worthy when they continue a held thread (Slice 5.4).
   */
  priorFacts?: readonly string[];
};

/**
 * Caregiver-facing care fact from an observation.
 * Empty human_fact (e.g. product meta) must never fall back to meta raw_text.
 * Pass priorFacts so thin thread continuations remain care-worthy.
 */
export function observationCareFact(params: {
  human_fact?: string | null;
  raw_text?: string | null;
  priorFacts?: readonly string[];
}): string | null {
  const opts =
    params.priorFacts && params.priorFacts.length > 0
      ? { priorFacts: params.priorFacts }
      : undefined;
  const hf = (params.human_fact ?? "").trim();
  if (hf) {
    return isCareRealityAnchorText(hf, opts) ? hf : null;
  }
  const raw = (params.raw_text ?? "").trim();
  if (!raw || isProductSessionMetaText(raw)) return null;
  return isCareRealityAnchorText(raw, opts) ? raw : null;
}

/**
 * Standalone care-reality check — no thread context.
 * Soft mood, natural-language unease, orientable care, and concrete observations count.
 */
export function isStandaloneCareRealityAnchor(text: string): boolean {
  const t = text
    .trim()
    .replace(/^(earlier|already held|new):\s*/i, "")
    .trim();
  if (!t || t.length < 4) return false;
  if (isProductSessionMetaText(t)) return false;
  if (
    /^(hi|hello|hey)\b/i.test(t) &&
    !hasOrientableCareContent(t) &&
    !isSoftVagueMoodNote(t) &&
    !looksLikeNaturalLanguageCareSignal(t)
  ) {
    return false;
  }
  // Soft mood / unwell notes are care reality — thin, but not product meta.
  if (isSoftVagueMoodNote(t)) return true;
  // Everyday change language (G54) — aligns emotional / NL paths with care anchors.
  if (looksLikeNaturalLanguageCareSignal(t)) return true;
  return (
    hasOrientableCareContent(t) ||
    looksLikeBaselineEstablishment(t) ||
    looksLikeConcreteObservation(t) ||
    classifyEpistemicClaim(t) === "caregiver_interpretation" ||
    classifyEpistemicClaim(t) === "baseline_establishment" ||
    classifyEpistemicClaim(t) === "mixed"
  );
}

/**
 * Thin follow-up continuing a held ACS care thread — principle-based, not phrase templates.
 * Example pattern: prior "she repeated…" → "Same questions again" (no person pronoun).
 */
export function isThinCareThreadContinuation(
  text: string,
  priorFacts: readonly string[],
): boolean {
  const t = text
    .trim()
    .replace(/^(earlier|already held|new):\s*/i, "")
    .trim();
  if (!t || t.length < 4) return false;
  if (isProductSessionMetaText(t)) return false;
  if (isStandaloneCareRealityAnchor(t)) return true;

  const anchors = priorFacts
    .map((f) => f.trim())
    .filter((f) => f.length > 0 && isStandaloneCareRealityAnchor(f));
  if (anchors.length === 0) return false;

  const continues =
    /\b(again|still|same|another|keeps? (?:happening|doing|asking)|more (?:of )?(?:the )?same|once more|yet again)\b/i.test(
      t,
    ) ||
    /\b(same|still)\b.{0,48}\b(question|questions|thing|behavior|pattern|way|issue)\b/i.test(t);

  const incomingTokens = contentTokens(t);
  if (incomingTokens.length === 0) return false;

  const priorTokens = contentTokens(anchors.join("\n"));
  const overlap = tokenOverlapCount(incomingTokens, priorTokens);

  // Shared substance + continuation marker, or stronger lexical overlap alone.
  if (continues && overlap >= 1) return true;
  if (overlap >= 2) return true;
  return false;
}

/**
 * Safe to use as prior care memory for continuity / Already held / connections.
 * Never use product meta, greetings, or guidance questions as care anchors.
 * With priorFacts, thin thread continuations count as care-worthy (Slice 5.4).
 */
export function isCareRealityAnchorText(
  text: string,
  options?: CareRealityAnchorOptions,
): boolean {
  if (isStandaloneCareRealityAnchor(text)) return true;
  if (options?.priorFacts && options.priorFacts.length > 0) {
    return isThinCareThreadContinuation(text, options.priorFacts);
  }
  return false;
}

/** Caregiver stating what is usual / preferred for this person. */
function looksLikeBaselineEstablishment(text: string): boolean {
  return /\b(usually|normally|always|every (?:morning|evening|day|afternoon)|typical for|loves?|hate[sd]?|prefers?|her normal|his normal)\b/i.test(
    text,
  );
}

export function classifyEpistemicClaim(text: string): EpistemicClaimKind {
  const t = text.trim();
  if (!t) return "observable_observation";
  const interp = looksLikeInterpretation(t);
  const obs = looksLikeConcreteObservation(t);
  const baseline = looksLikeBaselineEstablishment(t);

  if (baseline && !interp) return "baseline_establishment";
  if (interp && obs) return "mixed";
  if (interp && !obs) return "caregiver_interpretation";
  return "observable_observation";
}

/** Frame interpretation using *their* words — never a fixed “difficult” template. */
export function frameInterpretationHumanFact(text: string, subject: string): string {
  const { who, they } = subjectWho(subject);
  const clipped = text.trim().replace(/\s+/g, " ").slice(0, 120);
  const about = they ? "them" : who;
  return `You described ${about} this way: “${clipped}” — held as your experience, not a settled fact.`;
}

export function interpretationOrganizeAsks(subject: string): string[] {
  const usualLine =
    subject === "Mom"
      ? "her usual"
      : subject === "Dad"
        ? "his usual"
        : subject !== "Your loved one" && subject !== "they" && subject.trim()
          ? `${subject}'s usual`
          : "their usual";
  return [
    "What did you notice happening — something you saw, heard, or that was refused?",
    `Is this different from ${usualLine}?`,
  ];
}

function domainFor(text: string): FamiliarityDomain {
  // Broad structural domains — not illustration nouns
  if (/\b(sleep|nap|wake|awake|bedtime|insomnia)\b/i.test(text)) return "sleep";
  if (/\b(eat|eating|meal|appetite|breakfast|lunch|dinner|food|drink)\b/i.test(text)) {
    return "appetite";
  }
  if (/\b(walk|mobility|fall|unsteady|transfer)\b/i.test(text)) return "mobility";
  if (/\b(call|talk|conversation|speak|quiet|withdrawn)\b/i.test(text)) return "communication";
  if (/\b(mood|calm|upset|agitat|anxious|happy|sad|frustrat)\b/i.test(text)) return "mood";
  if (/\b(hate[sd]?|loves?|prefer|favorite|can't stand|does not like|doesn't like)\b/i.test(text)) {
    return "preference";
  }
  if (/\b(routine|morning|evening|habit|daily)\b/i.test(text)) return "routine";
  return "general";
}

function statementFromBaselineText(text: string, subject: string): string {
  const cleaned = text.trim().replace(/\s+/g, " ").slice(0, 140);
  const { possessive } = subjectWho(subject);
  if (/^mom|^dad|^she|^he/i.test(cleaned)) {
    return cleaned.endsWith(".") ? cleaned : `${cleaned}.`;
  }
  return `${possessive} usual: ${cleaned}${cleaned.endsWith(".") ? "" : "."}`;
}

type FamiliarityStore = {
  care_key: string;
  facts: FamiliarityBaselineFact[];
  updated_at: string;
};

const familiarityMemory = new Map<string, FamiliarityStore>();

function familiarityPath(careKey: string): string {
  return livingCareRecordDataDir(
    "familiarity-baseline",
    `${sanitizeDurableCareKey(careKey)}.json`,
  );
}

function loadFamiliarity(careKey: string): FamiliarityStore {
  const resolved = resolveEpistemicCareKey(careKey);
  const cached = familiarityMemory.get(resolved);
  if (cached) return cached;
  let durable = readDurableJson<FamiliarityStore>(familiarityPath(resolved));
  // Legacy: facts may exist under contributor id before Care Reality minting.
  if ((!durable?.facts || durable.facts.length === 0) && careKey !== resolved) {
    durable = readDurableJson<FamiliarityStore>(familiarityPath(careKey)) ?? durable;
  }
  if (durable?.facts) {
    // Backfill tokens for older records
    const facts = durable.facts.map((f) => ({
      ...f,
      content_tokens: f.content_tokens?.length
        ? f.content_tokens
        : contentTokens(f.source_text + " " + f.statement),
      care_key: resolved,
    }));
    const store = { ...durable, care_key: resolved, facts };
    familiarityMemory.set(resolved, store);
    return store;
  }
  return { care_key: resolved, facts: [], updated_at: new Date().toISOString() };
}

function saveFamiliarity(store: FamiliarityStore): void {
  const resolved = resolveEpistemicCareKey(store.care_key);
  const normalized = { ...store, care_key: resolved };
  familiarityMemory.set(resolved, normalized);
  writeDurableJson(familiarityPath(resolved), normalized);
}

export function listFamiliarityBaseline(careKey: string): FamiliarityBaselineFact[] {
  return [...loadFamiliarity(careKey).facts];
}

export function recordFamiliarityFromText(params: {
  careKey: string;
  rawText: string;
  subjectLabel: string;
  nowIso?: string;
}): FamiliarityBaselineFact[] {
  const kind = classifyEpistemicClaim(params.rawText);
  if (kind !== "baseline_establishment" && kind !== "mixed") {
    if (!looksLikeBaselineEstablishment(params.rawText)) return [];
  }
  const resolved = resolveEpistemicCareKey(params.careKey);
  const now = params.nowIso ?? new Date().toISOString();
  const domain = domainFor(params.rawText);
  const store = loadFamiliarity(resolved);
  const statement = statementFromBaselineText(params.rawText, params.subjectLabel);
  const tokens = contentTokens(params.rawText);
  const nextFacts = store.facts.filter(
    (f) =>
      !(
        f.domain === domain &&
        f.statement.toLowerCase().slice(0, 40) === statement.toLowerCase().slice(0, 40)
      ),
  );
  const fact: FamiliarityBaselineFact = {
    id: `fam_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    care_key: resolved,
    domain,
    statement,
    source_text: params.rawText.trim().slice(0, 200),
    established_at: now,
    content_tokens: tokens,
  };
  nextFacts.push(fact);
  saveFamiliarity({
    care_key: resolved,
    facts: nextFacts.slice(-24),
    updated_at: now,
  });
  return [fact];
}

export function familiarityDeviationNote(params: {
  careKey: string;
  rawText: string;
  subjectLabel: string;
  /**
   * When true, a durable baseline existed before this turn.
   * When omitted, inferred from store age: only treat as “earlier” if
   * at least one baseline entry was recorded before `nowIso` by > 1 minute
   * OR caller passes priorBaselineCount > 0 from before this ingest.
   */
  hadPriorBaseline?: boolean;
  nowIso?: string;
}): string | null {
  const facts = listFamiliarityBaseline(params.careKey);
  if (facts.length === 0) return null;
  if (classifyEpistemicClaim(params.rawText) === "baseline_establishment") return null;

  const nowMs = Date.parse(params.nowIso ?? new Date().toISOString());
  const priorFacts =
    params.hadPriorBaseline === false
      ? []
      : params.hadPriorBaseline === true
        ? facts
        : facts.filter((f) => {
            const recorded = Date.parse(f.established_at ?? "");
            if (!Number.isFinite(recorded) || !Number.isFinite(nowMs)) return false;
            // Baseline must pre-exist this capture — not same-note / same-second pollution.
            return nowMs - recorded > 60_000;
          });

  if (priorFacts.length === 0) {
    // In-note “isn’t like her” is caregiver-stated usual in this note — not prior memory.
    return null;
  }

  const incoming = contentTokens(params.rawText);
  const domain = domainFor(params.rawText);
  let relevant =
    priorFacts
      .map((f) => ({ f, n: tokenOverlapCount(f.content_tokens, incoming) }))
      .filter((x) => x.n >= 1)
      .sort((a, b) => b.n - a.n)[0]?.f ?? null;
  if (!relevant) {
    relevant = priorFacts.filter((f) => f.domain === domain).slice(-1)[0] ?? null;
  }
  if (!relevant) return null;

  const changeHint =
    /\b(today|this morning|lately|now|didn't|did not|stopped|more|less|than usual|different|again)\b/i.test(
      params.rawText,
    );
  if (!changeHint) return null;

  const { possessive } = subjectWho(params.subjectLabel);
  return `This may differ from ${possessive} usual pattern you shared earlier.`;
}

/** Drop Map cache only — durable familiarity remains (simulates process bounce). */
export function clearFamiliarityBaselineMemoryCache(): void {
  familiarityMemory.clear();
}

export function resetFamiliarityBaselineStore(): void {
  familiarityMemory.clear();
  clearDurableDirectory(livingCareRecordDataDir("familiarity-baseline"));
}

// ——— Gradual care signals (G40) — structural families, any topic ———

const SIGNAL_RULES: { family: CareSignalFamily; test: (t: string) => boolean }[] = [
  {
    family: "missed_obligation",
    test: (t) =>
      /\b(forgot|missed|didn't (?:make|get to|go|show)|did not (?:make|get to|go|show))\b/i.test(
        t,
      ),
  },
  {
    family: "unattended_hazard",
    test: (t) =>
      /\b(left .{0,40} (?:on|open|running|burning|unattended)|still on|forgot to (?:turn|shut) off)\b/i.test(
        t,
      ),
  },
  {
    family: "needed_assistance",
    test: (t) =>
      /\b(needed help|help (?:with|dressing|getting)|couldn't (?:manage|do|get) (?:dressed|ready)|unable to (?:dress|bathe|shower) (?:without|alone))\b/i.test(
        t,
      ),
  },
  {
    family: "wayfinding_difficulty",
    test: (t) =>
      /\b(got lost|couldn't find (?:the |her |his )?way|didn't know where|could not find (?:the )?way)\b/i.test(
        t,
      ),
  },
  {
    family: "misplaced_belonging",
    test: (t) =>
      /\b(misplaced|lost (?:the |her |his )?\w+|couldn't find .{0,30})\b/i.test(t) &&
      !/\bway\b/i.test(t),
  },
  {
    family: "communication_shift",
    test: (t) =>
      /\b(quieter|less talkative|harder to follow|trouble following|not talking as|withdrawal|withdrawn)\b/i.test(
        t,
      ),
  },
];

export function detectCareSignalFamily(text: string): CareSignalFamily | null {
  for (const rule of SIGNAL_RULES) {
    if (rule.test(text)) return rule.family;
  }
  if (looksLikeConcreteObservation(text) && !looksLikeInterpretation(text)) {
    return "other_observable";
  }
  return null;
}

type SignalStore = {
  care_key: string;
  signals: CareSignal[];
  updated_at: string;
};

const signalMemory = new Map<string, SignalStore>();

function signalPath(careKey: string): string {
  return livingCareRecordDataDir(
    "gradual-daily-living",
    `${sanitizeDurableCareKey(careKey)}.json`,
  );
}

function loadSignals(careKey: string): SignalStore {
  const resolved = resolveEpistemicCareKey(careKey);
  const cached = signalMemory.get(resolved);
  if (cached) return cached;
  let durable = readDurableJson<SignalStore & { signals?: CareSignal[] }>(
    signalPath(resolved),
  );
  if ((!durable?.signals || durable.signals.length === 0) && careKey !== resolved) {
    durable =
      readDurableJson<SignalStore & { signals?: CareSignal[] }>(signalPath(careKey)) ??
      durable;
  }
  if (durable?.signals) {
    const signals = durable.signals.map((s) => ({
      ...s,
      family: (s.family as CareSignalFamily) || "other_observable",
      care_key: resolved,
      content_tokens: s.content_tokens?.length
        ? s.content_tokens
        : contentTokens(s.source_text),
    }));
    const store = {
      care_key: resolved,
      signals,
      updated_at: durable.updated_at,
    };
    signalMemory.set(resolved, store);
    return store;
  }
  return { care_key: resolved, signals: [], updated_at: new Date().toISOString() };
}

function saveSignals(store: SignalStore): void {
  const resolved = resolveEpistemicCareKey(store.care_key);
  const normalized = { ...store, care_key: resolved };
  signalMemory.set(resolved, normalized);
  writeDurableJson(signalPath(resolved), normalized);
}

export function recordDailyLivingSignal(params: {
  careKey: string;
  rawText: string;
  nowIso?: string;
}): CareSignal | null {
  const family = detectCareSignalFamily(params.rawText);
  if (!family || family === "other_observable") {
    // Only accumulate distinct structural care-signal families for gradual change
    if (!family) return null;
  }
  // Include other_observable only when it carries distinct content for clustering
  const now = params.nowIso ?? new Date().toISOString();
  const tokens = contentTokens(params.rawText);
  if (family === "other_observable" && tokens.length < 2) return null;

  const resolved = resolveEpistemicCareKey(params.careKey);
  const store = loadSignals(resolved);
  const signal: CareSignal = {
    id: `sig_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    care_key: resolved,
    family,
    source_text: params.rawText.trim().slice(0, 200),
    content_tokens: tokens,
    recorded_at: now,
  };
  saveSignals({
    care_key: resolved,
    signals: [...store.signals, signal].slice(-36),
    updated_at: now,
  });
  return signal;
}

/** @deprecated alias — gradual store now holds CareSignal */
export function listDailyLivingSignals(careKey: string): CareSignal[] {
  return [...loadSignals(careKey).signals];
}

export type GradualChangeEvaluation = {
  emerging: boolean;
  distinct_families: CareSignalFamily[];
  signal_count: number;
  note: string | null;
  pattern_label: string | null;
};

export function evaluateGradualChange(careKey: string): GradualChangeEvaluation {
  const signals = listDailyLivingSignals(careKey).filter(
    (s) => s.family !== "other_observable",
  );
  const families = [...new Set(signals.map((s) => s.family))];
  const times = signals.map((s) => Date.parse(s.recorded_at)).filter(Number.isFinite);
  const spanMs = times.length >= 2 ? Math.max(...times) - Math.min(...times) : 0;
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const emerging =
    families.length >= 3 || (families.length >= 2 && spanMs >= weekMs);

  if (!emerging) {
    return {
      emerging: false,
      distinct_families: families,
      signal_count: signals.length,
      note: null,
      pattern_label: null,
    };
  }
  return {
    emerging: true,
    distinct_families: families,
    signal_count: signals.length,
    note: "Several related care changes have shown up over time — worth noticing before a crisis.",
    pattern_label: "gradual daily-living changes",
  };
}

// ——— Fluctuation (G43) ———

export type FluctuationEvaluation = {
  is_fluctuation: boolean;
  note: string | null;
  pattern_label: string | null;
};

export function evaluateDayFluctuation(params: {
  priorTexts: readonly string[];
  latestText: string;
}): FluctuationEvaluation {
  const priorHard = params.priorTexts.some(
    (t) =>
      /\b(confus\w*|agitat\w*|disoriented|mixed up|bad day|couldn't|wouldn't|upset)\b/i.test(
        t,
      ) && !looksLikeBaselineEstablishment(t),
  );
  const latestClearer =
    /\b(clearer|conversational|good day|more like (?:her|him)self|feeling better|doing better|chatty|herself today|himself today|back to normal)\b/i.test(
      params.latestText,
    );
  if (!priorHard || !latestClearer) {
    return { is_fluctuation: false, note: null, pattern_label: null };
  }
  return {
    is_fluctuation: true,
    note: "Today appeared clearer than recent observations — days can vary.",
    pattern_label: "day-to-day fluctuation",
  };
}

export function resetGradualDailyLivingStore(): void {
  signalMemory.clear();
  clearDurableDirectory(livingCareRecordDataDir("gradual-daily-living"));
}

// ——— Personhood / preference / unknown cause / safety (G41, G48, G45, G47) ———

/**
 * G41 — stop/loss language overlapping stored identity/preference facts.
 * Works for any activity or preference previously stored — not a fixed hobby list.
 */
export function evaluatePersonhoodLifeChange(params: {
  careKey: string;
  rawText: string;
  subjectLabel: string;
}): { matched: boolean; note: string | null; pattern_label: string | null } {
  const stop =
    /\b(stopped|no longer|doesn't|does not|quit|gave up|hasn't been|has not been|used to)\b/i.test(
      params.rawText,
    );
  if (!stop) return { matched: false, note: null, pattern_label: null };

  const facts = listFamiliarityBaseline(params.careKey).filter(
    (f) =>
      f.domain === "preference" ||
      /\b(loves?|enjoy|favorite|hate[sd]?|prefers?|usually|always)\b/i.test(f.source_text),
  );
  if (facts.length === 0) return { matched: false, note: null, pattern_label: null };

  const incoming = contentTokens(params.rawText);
  const best = facts
    .map((f) => ({ f, n: tokenOverlapCount(f.content_tokens, incoming) }))
    .filter((x) => x.n >= 1)
    .sort((a, b) => b.n - a.n)[0];
  if (!best) return { matched: false, note: null, pattern_label: null };

  const { who, they } = subjectWho(params.subjectLabel);
  return {
    matched: true,
    note: `This looks like a meaningful change from who ${they ? "they are" : who + " is"} — held against what you shared about ${they ? "them" : who} before.`,
    pattern_label: "personhood life change",
  };
}

/**
 * G48 — recall stored preference/identity when incoming note overlaps its content.
 * No special-case topics (hospitals, etc.) — overlap with stored fact is enough.
 */
export function evaluatePreferenceRecall(params: {
  careKey: string;
  rawText: string;
  subjectLabel: string;
}): { recalled: boolean; note: string | null; remembered: string | null } {
  const facts = listFamiliarityBaseline(params.careKey).filter(
    (f) =>
      f.domain === "preference" ||
      /\b(hate[sd]?|loves?|prefer|favorite|can't stand|does not like|doesn't like)\b/i.test(
        f.source_text,
      ),
  );
  if (facts.length === 0) return { recalled: false, note: null, remembered: null };

  const incoming = contentTokens(params.rawText);
  // Need real topical overlap — not the preference verb alone
  const best = facts
    .map((f) => ({ f, n: tokenOverlapCount(f.content_tokens, incoming) }))
    .filter((x) => x.n >= 1)
    .sort((a, b) => b.n - a.n)[0];
  if (!best) return { recalled: false, note: null, remembered: null };

  // Avoid recalling on the same note that established the preference
  if (
    best.f.source_text.trim().toLowerCase() === params.rawText.trim().toLowerCase()
  ) {
    return { recalled: false, note: null, remembered: null };
  }

  const { who, they } = subjectWho(params.subjectLabel);
  return {
    recalled: true,
    remembered: best.f.statement,
    note: `Remembered something about who ${they ? "they are" : who + " is"}: ${best.f.statement.replace(/\.$/, "")}.`,
  };
}

/**
 * G45 — change relative to usual without a stated cause.
 * Principle: notice + preserve unknown — never invent clinical explanations.
 */
export function evaluateUnknownCauseChange(params: {
  rawText: string;
  subjectLabel: string;
}): {
  is_unknown_cause_change: boolean;
  note: string | null;
  open_ask: string | null;
  invents_cause: boolean;
} {
  const invents_cause =
    /\b(because|due to|from the|caused by|depression|depressed|worsening|getting worse|side effect|probably the|likely)\b/i.test(
      params.rawText,
    );
  const changeWithoutCause =
    /\b(than usual|different|not (?:quite )?(?:her|him|them)self|something (?:feels|is) off|seems? (?:different|off)|not the same|quieter|less like)\b/i.test(
      params.rawText,
    ) && !invents_cause;

  if (!changeWithoutCause) {
    return {
      is_unknown_cause_change: false,
      note: null,
      open_ask: null,
      invents_cause,
    };
  }

  const { who, they } = subjectWho(params.subjectLabel);
  return {
    is_unknown_cause_change: true,
    note: `${they ? "A change" : "A change for " + who} is held — the cause is not known yet.`,
    open_ask: "What else have you noticed alongside this, if anything?",
    invents_cause: false,
  };
}

/**
 * G54 — everyday / vague caregiver language is a valid care observation.
 * Principle: do not require medical vocabulary to enter the Living Care Record.
 */
export function looksLikeNaturalLanguageCareSignal(text: string): boolean {
  const t = text.trim();
  if (t.length < 8) return false;
  // Everyday change / unease language (not a closed noun list of diseases)
  return (
    /\b(isn'?t (?:her|him|them)self|not (?:quite )?(?:her|him|them)self|feels? off|something (?:feels|is) off|not right|not the same|seems? (?:off|different|strange)|acting (?:different|strange)|out of sorts)\b/i.test(
      t,
    ) || evaluateUnknownCauseChange({ rawText: t, subjectLabel: "they" })
      .is_unknown_cause_change
  );
}

export function evaluateNaturalLanguageObservation(params: {
  rawText: string;
}): { accepted: boolean; note: string | null; pattern_label: string | null } {
  if (!looksLikeNaturalLanguageCareSignal(params.rawText)) {
    return { accepted: false, note: null, pattern_label: null };
  }
  // Prefer unknown-cause note when that principle also applies
  const unknown = evaluateUnknownCauseChange({
    rawText: params.rawText,
    subjectLabel: "they",
  });
  if (unknown.is_unknown_cause_change) {
    return { accepted: true, note: null, pattern_label: null };
  }
  return {
    accepted: true,
    note: "Held as a care observation — everyday language is enough.",
    pattern_label: "natural language observation",
  };
}

/**
 * G55 — question behind the question / continuity worry.
 * Principle: orient from held care reality (known / changed / context).
 * Never diagnose; never empty reassurance.
 */
export function evaluateContinuityWorry(params: {
  rawText: string;
  observationCount: number;
}): {
  is_continuity_worry: boolean;
  note: string | null;
  pattern_label: string | null;
} {
  const t = params.rawText.trim();
  const explicitWorry =
    /\b(is (?:this|she|he|it) getting worse|is this normal|should i (?:worry|be worried)|am i overreacting|does this mean)\b/i.test(
      t,
    );
  // Recognition / close-identity rupture — often carries unspoken trajectory fear
  const identityRupture =
    /\b(forgot|couldn'?t remember|did not remember|didn'?t remember)\b/i.test(t) &&
    /\b(name|who i (?:am|was)|who we (?:are|were)|who (?:his|her|their) (?:son|daughter|wife|husband|child))\b/i.test(
      t,
    );

  if (!explicitWorry && !identityRupture) {
    return { is_continuity_worry: false, note: null, pattern_label: null };
  }

  const hasContext = params.observationCount >= 1 || identityRupture || explicitWorry;
  if (!hasContext) {
    return { is_continuity_worry: false, note: null, pattern_label: null };
  }

  return {
    is_continuity_worry: true,
    note:
      params.observationCount > 1 || identityRupture
        ? "Oriented from what is already held — what is known and what changed, not a diagnosis."
        : "Held in the Living Care Record — we will orient from evidence as it grows, not diagnose from one line.",
    pattern_label: "continuity worry",
  };
}

/**
 * G47 — later note shares safety-area tokens with prior unattended-hazard signals.
 * Works for any hazard object previously recorded — not a fixed appliance list.
 */
export function evaluateSafetyContinuity(params: {
  careKey: string;
  rawText: string;
}): { linked: boolean; note: string | null; pattern_label: string | null } {
  const hazards = listDailyLivingSignals(params.careKey).filter(
    (s) => s.family === "unattended_hazard",
  );
  if (hazards.length === 0) return { linked: false, note: null, pattern_label: null };

  const incoming = contentTokens(params.rawText);
  const relatedIntent =
    /\b(alone|by (?:her|him|them)self|without (?:help|me|us)|wants? to .{0,40} alone)\b/i.test(
      params.rawText,
    ) || incoming.length >= 2;

  if (!relatedIntent) return { linked: false, note: null, pattern_label: null };

  const best = hazards
    .map((s) => ({ s, n: tokenOverlapCount(s.content_tokens, incoming) }))
    .filter((x) => x.n >= 1)
    .sort((a, b) => b.n - a.n)[0];

  const independence =
    /\b(alone|by (?:her|him|them)self|without (?:help|me|us))\b/i.test(params.rawText);

  if (!best && !independence) {
    return { linked: false, note: null, pattern_label: null };
  }

  return {
    linked: true,
    note: "This connects to an earlier safety concern in the record — same safety area, not a separate unrelated event.",
    pattern_label: "recurring safety area",
  };
}

// ——— G46 change vs crisis · G50 no blame · G51 disagreeing views ———

export type CareSignalSeverity = "contained_change" | "elevated_concern" | "unclassified";

/**
 * G46 — separate contained change from elevated safety concern.
 * Principle: not everything alarming; elevated when wayfinding failure or
 * unattended hazard / independence after hazard — not for every misplaced item.
 */
export function classifyCareSignalSeverity(text: string): CareSignalSeverity {
  const family = detectCareSignalFamily(text);
  if (family === "wayfinding_difficulty") return "elevated_concern";
  if (family === "unattended_hazard") return "elevated_concern";
  if (family === "misplaced_belonging") return "contained_change";
  if (family === "missed_obligation") return "contained_change";
  if (family === "needed_assistance") return "contained_change";
  if (family === "communication_shift") return "contained_change";
  // Leaving and not finding way back is elevated even if family detect is soft
  if (
    /\b(left (?:the )?house|went outside|wander\w*).{0,60}(couldn't find|could not find|got lost|didn't know where)\b/i.test(
      text,
    ) ||
    /\b(couldn't find|could not find|got lost).{0,60}(way (?:back|home)|home)\b/i.test(text)
  ) {
    return "elevated_concern";
  }
  return "unclassified";
}

/** Physical harm severity in caregiver text — any topic, not event-kind. */
export const PHYSICAL_HARM_SEVERITY_PATTERNS = [
  /\bhit (?:her|his|their|the) head\b/i,
  /\bhead (?:injury|trauma)\b/i,
  /\bbleed(?:ing|s)?\b/i,
  /\bunconscious\b/i,
  /\bpassed out\b/i,
  /\bcan(?:not|'t) get up\b/i,
  /\bstill on the (?:floor|ground)\b/i,
  /\b(?:broke|broken|fracture)\b/i,
  /\bwon'?t wake\b/i,
  /\bnot responding\b/i,
] as const;

/** Immediacy in caregiver text — happening now / just happened. */
export const PHYSICAL_HARM_IMMEDIACY_PATTERNS = [
  /\bjust (?:fell|happened|slipped|collapsed)\b/i,
  /\b(?:fell|fallen|collapsed|slipped) (?:just )?now\b/i,
  /\bright now\b/i,
  /\bmoments? ago\b/i,
  /\ba few (?:seconds|minutes) ago\b/i,
  /\bcurrently (?:on|lying) (?:the )?(?:floor|ground)\b/i,
  /\bneed(?:s)? help (?:getting )?up\b/i,
  /\bthis morning\b/i,
] as const;

export function hasPhysicalHarmSeverityMarkers(text: string): boolean {
  return PHYSICAL_HARM_SEVERITY_PATTERNS.some((p) => p.test(text));
}

export function hasPhysicalHarmImmediacyMarkers(text: string): boolean {
  return PHYSICAL_HARM_IMMEDIACY_PATTERNS.some((p) => p.test(text));
}

export function hasRecentHarmTiming(text: string): boolean {
  return /\b(this morning|just now|an hour ago|today at|minutes ago|right now|currently)\b/i.test(
    text,
  );
}

/** Structural harm event language — not classifyCareEventKind. */
export function mentionsPhysicalHarmEvent(text: string): boolean {
  return /\b(fell|fallen|fall(?:ing)?|collapsed|slipped|hit|injur|bleed|fracture|unconscious)\b/i.test(
    text,
  );
}

export function evaluateChangeVsCrisis(params: {
  rawText: string;
}): {
  severity: CareSignalSeverity;
  note: string | null;
  pattern_label: string | null;
} {
  const severity = classifyCareSignalSeverity(params.rawText);
  if (severity === "contained_change") {
    return {
      severity,
      note: "Held as a change to watch — not treated as a crisis by itself.",
      pattern_label: "contained change",
    };
  }
  if (severity === "elevated_concern") {
    return {
      severity,
      note: "This matters for safety orientation — held with care, without turning every note into an alarm.",
      pattern_label: "elevated safety concern",
    };
  }
  return { severity: "unclassified", note: null, pattern_label: null };
}

/**
 * G50 — caregiver reports missing a care action.
 * Principle: missed timing / care moment language — never judge the caregiver.
 */
export function looksLikeCaregiverMissedCareAction(text: string): boolean {
  return (
    /\b(i |i'm |i’ve |i've |i did not |i didn't |i forgot |i missed |i skipped |i failed to )\b/i.test(
      text,
    ) &&
    /\b(forgot|missed|didn't|did not|skipped|failed to)\b/i.test(text) &&
    /\b(give|gave|medic|dose|pill|appointment|pick(?:ed)? up|take|took|bring|brought)\b/i.test(
      text,
    )
  );
}

export function frameMissedCareHumanFact(text: string): string {
  const clipped = text.trim().replace(/\s+/g, " ").slice(0, 120);
  return `A care timing was missed: “${clipped}” — held to help manage care, not to judge.`;
}

export function evaluateCaregiverMissedCare(params: {
  rawText: string;
}): { is_missed_care: boolean; note: string | null; pattern_label: string | null } {
  if (!looksLikeCaregiverMissedCareAction(params.rawText)) {
    return { is_missed_care: false, note: null, pattern_label: null };
  }
  return {
    is_missed_care: true,
    note: "A care timing was missed — held so you can stay oriented, not to assign blame.",
    pattern_label: "missed care timing",
  };
}

type PerspectivePolarity = "needs_more_support" | "doing_fine" | "neutral";

function perspectivePolarity(text: string): PerspectivePolarity {
  if (
    /\b(needs? more help|can't (?:manage|cope)|cannot (?:manage|cope)|getting worse|not fine|struggling|overwhelmed)\b/i.test(
      text,
    )
  ) {
    return "needs_more_support";
  }
  if (
    /\b(she'?s fine|he'?s fine|they'?re fine|doing fine|doing (?:ok|okay|well)|nothing wrong|overreacting|exaggerat)\b/i.test(
      text,
    )
  ) {
    return "doing_fine";
  }
  return "neutral";
}

/**
 * G51 — disagreeing family/care views.
 * Principle: hold both; never choose sides.
 */
export function evaluateDisagreeingViews(params: {
  priorTexts: readonly string[];
  rawText: string;
}): { disagreement: boolean; note: string | null; pattern_label: string | null } {
  const incoming = perspectivePolarity(params.rawText);
  if (incoming === "neutral") {
    return { disagreement: false, note: null, pattern_label: null };
  }
  const priorOpposite = params.priorTexts.some((t) => {
    const p = perspectivePolarity(t);
    return (
      (incoming === "needs_more_support" && p === "doing_fine") ||
      (incoming === "doing_fine" && p === "needs_more_support")
    );
  });
  // Also explicit contrast markers with an evaluative claim
  const contrast =
    /\b(but |actually |i (?:don't|do not) (?:agree|think)|on the other hand)\b/i.test(
      params.rawText,
    );
  if (!priorOpposite && !contrast) {
    return { disagreement: false, note: null, pattern_label: null };
  }
  // Contrast alone without prior opposite still needs a prior evaluative note
  if (!priorOpposite && contrast) {
    const priorEval = params.priorTexts.some((t) => perspectivePolarity(t) !== "neutral");
    if (!priorEval) return { disagreement: false, note: null, pattern_label: null };
  }

  return {
    disagreement: true,
    note: "More than one view is held in the record — SolenOS is not choosing sides.",
    pattern_label: "disagreeing care views",
  };
}

export function resetCareEpistemicsStores(): void {
  resetFamiliarityBaselineStore();
  resetGradualDailyLivingStore();
}

/** @deprecated — use CareSignalFamily */
export type DailyLivingSignalFamily = CareSignalFamily;
