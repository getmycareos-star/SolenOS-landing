/**
 * Dementia-entry extended gates (Tier 4) — principle-based, not illustration nouns.
 *
 * G31/G35 — repeated questions → pattern, not separate events / not “worsening”
 * G33 — routine disruption vs stored usual — not dismissed as unrelated
 * G36 — situation behind a fact — hold situation, never diagnose fear/confusion
 * G38 — dignity language (composer bans also enforce)
 * G39 — care transition memory — not random event framing
 * G42 — “is this normal?” as care signal (continuity orientation)
 * G49 — caregiver role transition over time
 * G52 — historical importance (prior hazard/fall ↔ later related note)
 * G53 — journey milestones — not ordinary timeline dump
 * G58 — ambiguous change language → ask what differed, never assign meaning
 * G59 — no population comparison (composer bans)
 * G60 — advanced care sensitivity — never medical decision engine
 */

export const DEMENTIA_ENTRY_EXTENDED_PURPOSE =
  "Extended dementia-entry acceptance: pattern over dump, dignity, no population FAQ.";

function normalizeQuestionish(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(
      /\b(she|he|they|mom|dad|keeps?|again|over and over|repeatedly|asked?|asking|said|says|this|morning|afternoon|evening|lunch|dinner|today|yesterday)\b/g,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function contentOverlap(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const stem = a.length <= b.length ? a : b;
  const other = a.length <= b.length ? b : a;
  if (stem.length >= 10 && other.includes(stem.slice(0, Math.min(14, stem.length)))) {
    return true;
  }
  const aw = new Set(a.split(" ").filter((w) => w.length > 2));
  const bw = b.split(" ").filter((w) => w.length > 2);
  if (aw.size === 0 || bw.length === 0) return false;
  let n = 0;
  for (const w of bw) if (aw.has(w)) n += 1;
  return n >= 2 && n / Math.min(aw.size, bw.length) >= 0.5;
}

function looksLikeRepeatedAsk(text: string): boolean {
  return (
    /\b(ask(?:ed|ing|s)?|keeps? (?:asking|saying)|over and over|again and again|same question|repeatedly)\b/i.test(
      text,
    ) || /\?\s*$/.test(text.trim())
  );
}

/**
 * G31 / G35 — same question content recurring → one pattern, not N unrelated events.
 */
export function evaluateRepeatedQuestionPattern(params: {
  priorTexts: readonly string[];
  latestText: string;
}): {
  is_pattern: boolean;
  occurrence_count: number;
  note: string | null;
  pattern_label: string | null;
} {
  const latest = params.latestText.trim();
  const key = normalizeQuestionish(latest);
  if (key.length < 6) {
    return { is_pattern: false, occurrence_count: 1, note: null, pattern_label: null };
  }

  // Count priors that share question content (latest may or may not use "asking" language)
  let count = 1;
  for (const prior of params.priorTexts) {
    const pk = normalizeQuestionish(prior);
    if (contentOverlap(pk, key)) count += 1;
  }

  const askingContext =
    looksLikeRepeatedAsk(latest) ||
    params.priorTexts.some((t) => looksLikeRepeatedAsk(t));

  if (!askingContext || count < 3) {
    return { is_pattern: false, occurrence_count: count, note: null, pattern_label: null };
  }

  return {
    is_pattern: true,
    occurrence_count: count,
    note: "The same question is showing up repeatedly — held as a pattern, not separate unrelated events.",
    pattern_label: "repeated question pattern",
  };
}

/**
 * G58 — ambiguous “something is off / acting different” without concrete detail.
 * Ask what differed; never assign clinical meaning.
 */
export function evaluateAmbiguousBehaviorShift(params: {
  rawText: string;
}): {
  is_ambiguous: boolean;
  note: string | null;
  open_ask: string | null;
  pattern_label: string | null;
  assigns_meaning: false;
} {
  const t = params.rawText.trim();
  const ambiguous =
    /\b(acting (?:strange|weird|different|odd)|something(?:'s| is) (?:off|wrong|weird)|not quite right|out of sorts|behaved? differently)\b/i.test(
      t,
    ) &&
    !/\b(because|fell|ate|refus|medication|dose|hit|walked|said .{0,40}\?)\b/i.test(t);

  if (!ambiguous) {
    return {
      is_ambiguous: false,
      note: null,
      open_ask: null,
      pattern_label: null,
      assigns_meaning: false,
    };
  }

  return {
    is_ambiguous: true,
    note: "A change was noticed — held without assigning a meaning yet.",
    open_ask: "What seemed different from usual?",
    pattern_label: "ambiguous behavior shift",
    assigns_meaning: false,
  };
}

/**
 * G42 — uncertainty-about-normal as care signal (extends continuity worry principle).
 */
export function evaluateNormalcyUncertainty(params: {
  rawText: string;
}): {
  is_normalcy_signal: boolean;
  note: string | null;
  pattern_label: string | null;
} {
  const t = params.rawText.trim();
  if (
    !/\b(is this normal|i don'?t know if this is normal|not sure if (?:this|that) is normal|should this be happening)\b/i.test(
      t,
    )
  ) {
    return { is_normalcy_signal: false, note: null, pattern_label: null };
  }
  return {
    is_normalcy_signal: true,
    note: "Uncertainty about what is usual is held as a care signal — oriented from evidence, not empty reassurance.",
    pattern_label: "normalcy uncertainty",
  };
}

/** G38 / G32 / G59 / G60 — phrases that must never reach caregivers. */
export const DIGNITY_AND_POPULATION_BANNED = [
  "dementia patient",
  "failed to remember",
  "behavior problem",
  "other dementia patients",
  "other patients usually",
  "patients with dementia usually",
  "typical for dementia",
  "this is normal for dementia",
] as const;

export const ADVANCED_CARE_DECISION_ENGINE_BANNED = [
  "you should choose",
  "i recommend you sign",
  "you must decide now",
  "the right choice is",
  "medical decision for you",
] as const;

/**
 * G33 — stop/loss of a usual activity or routine → meaningful disruption.
 * Works for any previously usual activity language — not a fixed hobby list.
 */
export function evaluateRoutineDisruption(params: {
  rawText: string;
  familiarityStatements?: readonly string[];
}): {
  is_disruption: boolean;
  note: string | null;
  pattern_label: string | null;
  dismissed: false;
} {
  const t = params.rawText.trim();
  const stop =
    /\b(stopp?ed|no longer|doesn'?t .+ anymore|quit|gave up|hasn'?t been)\b/i.test(t) &&
    !/\b(medication|medicine|pill|dose)\b/i.test(t);
  if (!stop) {
    return { is_disruption: false, note: null, pattern_label: null, dismissed: false };
  }

  const fam = params.familiarityStatements ?? [];
  const incoming = t.toLowerCase();
  const overlapsFamiliar =
    fam.length === 0 ||
    fam.some((s) => {
      const words = s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 3);
      return words.some((w) => incoming.includes(w));
    });

  // Even without familiarity overlap, stop-of-activity is a care-relevant disruption
  if (!overlapsFamiliar && fam.length > 0) {
    // Still hold — do not dismiss as unrelated
  }

  return {
    is_disruption: true,
    note: "A usual routine looks disrupted — held as part of the care journey, not dismissed as unrelated.",
    pattern_label: "routine disruption",
    dismissed: false,
  };
}

/**
 * G36 — fact that often hides a larger care situation (won't leave / won't bathe / etc.).
 * Hold the situation; never diagnose fear or confusion.
 */
export function evaluateSituationBehindFact(params: {
  rawText: string;
}): {
  is_situation_behind: boolean;
  note: string | null;
  open_ask: string | null;
  pattern_label: string | null;
  diagnoses: false;
} {
  const t = params.rawText.trim();
  const behind =
    /\b(won'?t leave|will not leave|refuses? to leave|won'?t go (?:out|outside|to)|doesn'?t want to leave|won'?t (?:bathe|shower|get dressed)|refuses? (?:bath|shower))\b/i.test(
      t,
    );
  if (!behind) {
    return {
      is_situation_behind: false,
      note: null,
      open_ask: null,
      pattern_label: null,
      diagnoses: false,
    };
  }
  return {
    is_situation_behind: true,
    note: "There may be more going on behind this — held as a care situation, not a diagnosis.",
    open_ask: "What makes this hard right now, if you can say?",
    pattern_label: "situation behind fact",
    diagnoses: false,
  };
}

/**
 * G39 — care setting / responsibility transition language.
 */
export function evaluateCareTransition(params: {
  rawText: string;
}): {
  is_transition: boolean;
  note: string | null;
  pattern_label: string | null;
} {
  const t = params.rawText.trim();
  if (
    !/\b(discharg\w*|came home from|home from the hospital|moved (?:to|into)|facility|rehab|hospice|home care (?:start|began|agency)|care transition|transition(?:ed|ing)? (?:home|to))\b/i.test(
      t,
    )
  ) {
    return { is_transition: false, note: null, pattern_label: null };
  }
  return {
    is_transition: true,
    note: "A care transition is held in the Living Care Record — not treated as a one-off random event.",
    pattern_label: "care transition",
  };
}

/**
 * G49 — caregiver role / responsibility change over time.
 */
export function evaluateCaregiverRoleTransition(params: {
  rawText: string;
}): {
  is_role_change: boolean;
  note: string | null;
  pattern_label: string | null;
} {
  const t = params.rawText.trim();
  if (
    !/\b(i'?m (?:now )?the (?:primary|main) caregiver|i am (?:now )?the (?:primary|main)|taking over (?:from|care)|used to (?:handle|manage)|sister (?:used to|was)|brother (?:used to|was)|now i(?:'m| am) (?:handling|managing|responsible))\b/i.test(
      t,
    )
  ) {
    return { is_role_change: false, note: null, pattern_label: null };
  }
  return {
    is_role_change: true,
    note: "A change in who carries care responsibility is held — roles can shift over time.",
    pattern_label: "caregiver role transition",
  };
}

/**
 * G52 — later mobility/safety note overlapping prior fall / unattended hazard evidence.
 */
export function evaluateHistoricalImportance(params: {
  priorTexts: readonly string[];
  rawText: string;
}): {
  linked: boolean;
  note: string | null;
  pattern_label: string | null;
} {
  const priorFallOrHazard = params.priorTexts.some(
    (t) =>
      /\b(fell|fall|fallen|tripped|left .{0,40} (?:on|open)|unattended)\b/i.test(t),
  );
  const laterMobility =
    /\b(walk|walking|mobility|unsteady|afraid to walk|won'?t walk|trouble (?:standing|walking))\b/i.test(
      params.rawText,
    );
  if (!priorFallOrHazard || !laterMobility) {
    return { linked: false, note: null, pattern_label: null };
  }
  return {
    linked: true,
    note: "This connects to earlier safety evidence in the record — history still matters.",
    pattern_label: "historical importance",
  };
}

/**
 * G53 — journey milestone language (firsts, discharges, major turns).
 */
export function evaluateJourneyMilestone(params: {
  rawText: string;
}): {
  is_milestone: boolean;
  note: string | null;
  pattern_label: string | null;
} {
  const t = params.rawText.trim();
  if (
    !/\b(first time (?:she|he|they)|for the first time|milestone|came home for good|discharged home|started needing help with|major (?:change|turn)|turning point)\b/i.test(
      t,
    )
  ) {
    return { is_milestone: false, note: null, pattern_label: null };
  }
  return {
    is_milestone: true,
    note: "This is held as a journey milestone — more than an ordinary timeline entry.",
    pattern_label: "journey milestone",
  };
}

/**
 * G60 — advanced care / goals-of-care sensitivity.
 * Hold with care; never act as a medical decision engine.
 */
export function evaluateAdvancedCareSensitivity(params: {
  rawText: string;
}): {
  is_advanced_care: boolean;
  note: string | null;
  pattern_label: string | null;
  is_decision_engine: false;
} {
  const t = params.rawText.trim();
  if (
    !/\b(dnr|do not resuscitate|polst|advance directive|living will|goals? of care|hospice|comfort care|palliative|power of attorney|healthcare proxy)\b/i.test(
      t,
    )
  ) {
    return {
      is_advanced_care: false,
      note: null,
      pattern_label: null,
      is_decision_engine: false,
    };
  }
  return {
    is_advanced_care: true,
    note: "Advanced care wishes are held with care — SolenOS will not make medical decisions for you.",
    pattern_label: "advanced care sensitivity",
    is_decision_engine: false,
  };
}
