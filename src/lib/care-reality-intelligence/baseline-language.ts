/**
 * Baseline language engine — reads prior→now discourse the way caregivers speak it.
 *
 * Why this exists: change-from-usual is the product's core promise, and a single
 * `/\b(?:used to|but now)\b/` regex cannot read the language caregivers actually
 * use. This module models the discourse explicitly:
 *
 * - many more comparative constructions ("up until the fall", "he hasn't been
 *   himself since", "different from last week", "same as always", "her normal is")
 * - prior span vs now span separated per clause, with negation preserved
 * - domain tagging (function / eating / sleep / cognition / mood / mobility /
 *   medication / continence / pain / skin / social / care setup)
 * - **quantity comparison**: "3 hours" vs "his usual 7" is a real difference even
 *   when no cue word appears — impossible for a cue regex alone
 * - onset and stability statements, kept separate from the change itself
 *
 * Nothing here diagnoses, dates a condition, or claims causation. It only
 * separates *what was usual* from *what is happening now*, as the caregiver said it.
 */

import type { BaselineDomain } from "./baseline-comparison-engine";

/** Cue families for prior/usual discourse. */
export const HABITUAL_CUES: RegExp[] = [
  /\bused to\b/i,
  /\b(?:usually|normally|typically|ordinarily|generally|in general)\b/i,
  /\b(?:always|all the time|every (?:day|morning|evening|night|week|afternoon))\b/i,
  /\bher (?:normal|usual|baseline|standard)\b/i,
  /\bhis (?:normal|usual|baseline|standard)\b/i,
  /\btheir (?:normal|usual|baseline|standard)\b/i,
  /\bat baseline\b/i,
  /\bup until\b/i,
  /\buntil (?:the|a|an) (?:fall|admission|discharge|appointment|medication change|dose change|diagnosis|surgery|hospital)\b/i,
  /\bprior to\b/i,
  /\bbefore (?:the|this|that|his|her|their|last|it all)\b/i,
  /\bin the past\b/i,
  /\bpreviously\b/i,
  /\bwhat was (?:normal|usual)\b/i,
  /\bthe same as (?:always|usual|before)\b/i,
  /\bsame as (?:always|usual|before)\b/i,
  /\bover the (?:last|past) (?:few|couple)?\s*(?:months?|weeks?|years?)\b/i,
  /\bfor (?:as long as i can remember|years|most of (?:his|her|their) life)\b/i,
  /\bwhen (?:he|she|they) (?:was|were) (?:able|still|could)\b/i,
  /\bwould (?:always|usually|normally)\b/i,
  /\bhas always been\b/i,
  /\bas long as (?:i'?ve|i have) (?:known|seen|knew)\b/i,
];

/** Cue families for current-state / departure-from-usual discourse. */
export const CHANGE_CUES: RegExp[] = [
  /\bbut now\b/i,
  /\bnow (?:he|she|they|it|there)\b/i,
  /\bthese days\b/i,
  /\b(?:lately|recently|of late)\b/i,
  /\bno longer\b/i,
  /\b(?:any ?more|anymore)\b/i,
  /\bnot (?:like|himself|herself|themselves) (?:her|his|their|it)?\b/i,
  /\bhasn'?t been (?:himself|herself|themselves|like)\b/i,
  /\bdifferent (?:from|than|to)\b/i,
  /\bchanged\b/i,
  /\b(?:is|has been) (?:more|less|harder|easier|difficult|confused|sleepy|agitated|withdrawn)\b/i,
  /\b(?:can'?t|couldn'?t|not able to|unable to)\b/i,
  /\bstopped\b/i,
  /\bstarted\b/i,
  /\bbegan\b/i,
  /\b(?:fell|fallen|slipped|tripped|collapsed)\b/i,
  /\bnew\b/i,
  /\bfirst time\b/i,
  /\b(?:worse|getting worse|gotten worse)\b/i,
  /\b(?:better|improving|recovering)\b/i,
  /\bthird (?:time|night|day) in a row\b/i,
  /\bkeeps? (?:asking|doing|calling|forgetting)\b/i,
  /\bsince (?:the|last|about|around|yesterday|tuesday|monday|\d)\b/i,
  /\bfor the past (?:few|couple|\d+)\b/i,
  /\bover the (?:last|past) (?:few|couple|\d+)\b/i,
];

/** Change-onset markers — "when did it start" evidence. */
export const ONSET_CUES: RegExp[] = [
  /\bsince\b/i,
  /\bfor the past\b/i,
  /\bover the (?:last|past)\b/i,
  /\bstarted (?:on|last|after|around)\b/i,
  /\bbegan (?:on|last|after|around)\b/i,
  /\bafter (?:the|his|her|their|his last)\b/i,
  /\bwhen (?:it|this|he|she|they) (?:first )?(?:started|began|got|got worse|changed)\b/i,
  /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|last night|yesterday|today|tonight)\b/i,
  /\b\d+\s*(?:days?|weeks?|months?)\s*ago\b/i,
  /\bin the (?:last|past) (?:day|night|week|month)\b/i,
];

/** Stability markers — "this has not changed", a real and often missed signal. */
export const STABILITY_CUES: RegExp[] = [
  /\b(?:stable|steady|unchanged|no change|same as (?:before|always)|consisten(?:t|cy))\b/i,
  /\bnot (?:changed|gotten (?:worse|better))\b/i,
  /\bkeeps? (?:going|being) the same\b/i,
  /\bsettled\b/i,
  /\bback to (?:normal|usual|himself|herself|themselves)\b/i,
  /\bimproving\b/i,
  /\bbetter than (?:before|last week|it was)\b/i,
];

const DOMAIN_CUES: { domain: BaselineDomain; pattern: RegExp }[] = [
  { domain: "cognition", pattern: /\b(?:confus|forget|memory|recognis|recogniz|orient|repeat|disorient|knows? (?:where|who)|apologi[sz])/i },
  { domain: "behavior", pattern: /\b(?:agitat|restless|shout|argu|hid|hoard|wand|irritab|withdrew|anxious|calm(?:er)?|sundown|refus)/i },
  { domain: "function", pattern: /\b(?:walk|toilet|bath|dress|shower|transfer|lift|feed|independent|assist|help(?:ed)?|able to|can'?t get|stairs)/i },
  { domain: "physical", pattern: /\b(?:fall|fell|slipp|tripp|collaps|pain|weak|dizzy|breath|swoll|skin|sore|weight|injur)/i },
  { domain: "medical", pattern: /\b(?:medication|medicine|pill|dose|hospital|discharg|admission|clinic|doctor|infection|urine|constipat|sleep|appetite|food|fluid|drink)/i },
];

/** Quantity comparison: a measured "now" against a stated usual. */
export type QuantityComparison = {
  domain: BaselineDomain;
  label: string;
  current: number;
  baseline: number;
  unit: string;
  /** Direction of departure from usual. */
  direction: "lower_than_usual" | "higher_than_usual" | "same_as_usual";
  /** Plain-language difference, e.g. "about 4 hours less than his usual night". */
  difference_phrase: string;
  evidence: string;
};

export type BaselineReading = {
  /** Statements describing what was usual / before. */
  baseline_statements: string[];
  /** Statements describing what is happening now. */
  change_statements: string[];
  /** When the change started, when stated. */
  onset_statements: string[];
  /** Explicit stability statements — absence of change, stated. */
  stability_statements: string[];
  /** Numeric departures from a stated usual. */
  quantity_comparisons: QuantityComparison[];
  /** Domains where a prior→now difference is described. */
  changed_domains: BaselineDomain[];
  /** Domains where a prior is held but no change is stated. */
  stable_domains: BaselineDomain[];
  /** Prior→now pairs for the same clause, when both sides are present. */
  pairs: { prior: string; current: string; domain: BaselineDomain }[];
  /** True when any prior-usual evidence exists in this text. */
  has_prior: boolean;
  /** True when any departure-from-usual evidence exists in this text. */
  has_change: boolean;
  /** True when a numeric difference against a stated usual exists. */
  has_quantity_change: boolean;
};

const EMPTY_READING: BaselineReading = {
  baseline_statements: [],
  change_statements: [],
  onset_statements: [],
  stability_statements: [],
  quantity_comparisons: [],
  changed_domains: [],
  stable_domains: [],
  pairs: [],
  has_prior: false,
  has_change: false,
  has_quantity_change: false,
};

function matchesAny(text: string, cues: RegExp[]): boolean {
  return cues.some((cue) => cue.test(text));
}

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function splitBaselineClauses(text: string): string[] {
  return clean(text)
    .split(/(?<=[.!?])\s+|;\s+|\s+—\s+|\s+-\s+/)
    .map(clean)
    .filter((c) => c.length >= 6);
}

export function domainForClause(clause: string): BaselineDomain {
  for (const { domain, pattern } of DOMAIN_CUES) {
    if (pattern.test(clause)) return domain;
  }
  return "general";
}

/** Prior span of a clause, i.e. everything before the turn marker. */
export function priorSpanOf(clause: string): string | null {
  const cut = clause.split(
    /\b(?:but now|but these days|now|these days|anymore|any more|no longer|for the past|over the past|over the last|since)\b/i,
  )[0];
  const span = clean(cut ?? "");
  if (span.length < 6) return null;
  return matchesAny(span, HABITUAL_CUES) ? span : null;
}

/** Now span of a clause, i.e. the part after the turn marker. */
export function currentSpanOf(clause: string): string | null {
  const parts = clause.split(
    /\b(?:but now|but these days|now|these days|anymore|any more|no longer|since|for the past|over the past|over the last)\b/i,
  );
  if (parts.length < 2) return null;
  const span = clean(parts.slice(1).join(" "));
  return span.length >= 4 ? span : null;
}

/* ------------------------------------------------------------------ */
/*  Quantity comparison                                                 */
/* ------------------------------------------------------------------ */

type QuantityKind = "sleep" | "fluid" | "food" | "mobility" | "weight" | "sleep_count" | "generic";

const QUANTITY_CUES: { kind: QuantityKind; label: string; unit: string; pattern: RegExp }[] = [
  {
    kind: "sleep",
    label: "sleep",
    unit: "hours",
    pattern: /\b(?:slept|sleeping|sleep|up|awake)\D{0,18}(\d{1,2}(?:\.\d)?)\s*(?:hours?|hrs?)\b/i,
  },
  {
    kind: "fluid",
    label: "drink",
    unit: "cups",
    pattern: /\b(?:drank|drinking|drinks?|had)\D{0,18}(\d{1,3}(?:\.\d)?)\s*(?:cups?|glasses?|bottles?)\b/i,
  },
  {
    kind: "food",
    label: "meals",
    unit: "meals",
    pattern: /\b(?:ate|eaten|meals?|had)\D{0,18}(\d{1,2})\s*(?:meals?|times)\b/i,
  },
  {
    kind: "mobility",
    label: "walking",
    unit: "times",
    pattern: /\b(?:walked|walking|walks?)\D{0,18}(\d{1,3})\s*(?:times|laps)\b/i,
  },
  {
    kind: "sleep_count",
    label: "nights up",
    unit: "nights",
    pattern: /\b(?:up|calling|woke)\D{0,22}(\d{1,2})\s*(?:nights?|times)\b/i,
  },
];

function domainForQuantity(kind: QuantityKind): BaselineDomain {
  switch (kind) {
    case "sleep":
    case "sleep_count":
      return "medical";
    case "fluid":
    case "food":
      return "medical";
    case "mobility":
      return "function";
    default:
      return "general";
  }
}

/** A stated usual that may be written as a digit or a plain word. */
const USUAL_NUMBER_PATTERN =
  /(?:where (?:he|she|they) (?:usually|normally)|usually|normally|always|used to|typically|her normal is|his normal is|their normal is)\b[^.!?]{0,24}?(?:about |around |roughly |nearly |over |almost |only |)?(\d{1,3}(?:\.\d)?|once|twice|three times|four times|five times|six times|seven times|eight times|nine times|one|two|three|four|five|six|seven|eight|nine|ten)/i;

const WORD_NUMBERS: Record<string, number> = {
  once: 1, one: 1, twice: 2, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, "three times": 3, "four times": 4, "five times": 5,
  "six times": 6, "seven times": 7, "eight times": 8, "nine times": 9,
};

function parseStatedNumber(token: string): number | null {
  const digit = Number(token);
  if (Number.isFinite(digit)) return digit;
  return WORD_NUMBERS[token.toLowerCase()] ?? null;
}

/**
 * Find numeric departures from a stated usual.
 * Handles both "3 hours where he usually does 7" and "slept 3 hours, down from 7".
 */
export function quantityComparisons(text: string): QuantityComparison[] {
  const out: QuantityComparison[] = [];
  const clauses = splitBaselineClauses(text);
  for (const clause of clauses) {
    const priorContext = /\b(?:usual(?:ly)?|normally|always|used to|typically|her normal|his normal|their normal|baseline|before|down from|compared to|where (?:he|she|they) (?:usually|normally))\b/i.test(
      clause,
    );
    if (!priorContext) continue;

    const currentNums: { value: number; kind: QuantityKind; index: number }[] = [];
    const usualNums: { value: number; kind: QuantityKind }[] = [];
    for (const cue of QUANTITY_CUES) {
      const re = new RegExp(cue.pattern.source, "gi");
      let m: RegExpExecArray | null;
      while ((m = re.exec(clause)) !== null) {
        const value = Number(m[1]);
        if (!Number.isFinite(value)) continue;
        const after = clause.slice(m.index + m[0].length, m.index + m[0].length + 40);
        // A comparative connector must sit immediately after the number, and the
        // "usual" side of the comparison is what follows it:
        //   "3 hours, down from 7"      -> 3 is current, 7 is usual
        //   "3 hours, where she does 7" -> 3 is current, 7 is usual
        //   "she usually has 7 hours"   -> 7 is usual
        const isUsual =
          /^\s*(?:,\s*)?(?:usually|normally|always|used to|typically|her normal is|his normal is|their normal is)\b/i.test(after) ||
          /\b(?:from|than|instead of)\s*$/i.test(clause.slice(Math.max(0, m.index - 6), m.index));
        if (isUsual) usualNums.push({ value, kind: cue.kind });
        else currentNums.push({ value, kind: cue.kind, index: m.index });
      }
    }

    for (const current of currentNums) {
      // A stated usual may appear with no unit of its own
      // ("3 hours, where she usually does about 7").
      if (usualNums.length === 0) {
        const stated = USUAL_NUMBER_PATTERN.exec(clause);
        if (stated) {
          const value = parseStatedNumber(stated[1] ?? "");
          if (value !== null) usualNums.push({ value, kind: current.kind });
        }
      }
      const baselineEntry =
        usualNums.find((u) => u.kind === current.kind) ??
        (current.kind === "sleep_count" ? usualNums.find((u) => u.kind === "sleep") : undefined) ??
        (current.kind === "sleep" ? usualNums.find((u) => u.kind === "sleep_count") : undefined) ??
        usualNums[0];
      if (!baselineEntry) continue;
      const cue = QUANTITY_CUES.find((c) => c.kind === current.kind) ?? QUANTITY_CUES.find((c) => c.kind === baselineEntry.kind);
      if (!cue) continue;
      const baseline = baselineEntry.value;
      const diff = Math.round((baseline - current.value) * 10) / 10;
      const direction: QuantityComparison["direction"] =
        Math.abs(diff) < 0.05 ? "same_as_usual" : diff > 0 ? "lower_than_usual" : "higher_than_usual";
      out.push({
        domain: domainForQuantity(current.kind),
        label: cue.label,
        current: current.value,
        baseline,
        unit: cue.unit,
        direction,
        difference_phrase:
          Math.abs(diff) < 0.05
            ? `about the same as usual`
            : `about ${Math.abs(diff)} ${cue.unit} ${diff > 0 ? "less" : "more"} than usual`,
        evidence: clean(clause).slice(0, 200),
      });
      if (out.length >= 4) return out;
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  Full reading                                                       */
/* ------------------------------------------------------------------ */

/**
 * Read prior→now discourse out of one caregiver message.
 * Deterministic and allocation-light; safe to call on every capture.
 */
export function readBaselineLanguage(text: string): BaselineReading {
  const t = text.trim();
  if (t.length < 8) return { ...EMPTY_READING };

  const reading: BaselineReading = {
    baseline_statements: [],
    change_statements: [],
    onset_statements: [],
    stability_statements: [],
    quantity_comparisons: [],
    changed_domains: [],
    stable_domains: [],
    pairs: [],
    has_prior: false,
    has_change: false,
    has_quantity_change: false,
  };

  const clauseSpans: string[] = [];
  const clauseFacts: { index: number; prior: string | null; current: string | null; domain: BaselineDomain; hasChange: boolean }[] = [];
  for (const clause of splitBaselineClauses(t)) {
    const clauseIndex = clauseSpans.length;
    clauseSpans.push(clause);
    const domain = domainForClause(clause);
    const hasHabitual = matchesAny(clause, HABITUAL_CUES);
    const hasChange = matchesAny(clause, CHANGE_CUES);
    const hasStability = matchesAny(clause, STABILITY_CUES);
    const prior = priorSpanOf(clause);
    const current = currentSpanOf(clause);
    clauseFacts.push({ index: clauseIndex, prior, current, domain, hasChange });

    if (hasStability && !hasChange) {
      const span = clean(clause).slice(0, 180);
      if (!reading.stability_statements.includes(span)) reading.stability_statements.push(span);
      if (!reading.stable_domains.includes(domain)) reading.stable_domains.push(domain);
      if (hasHabitual || prior) {
        const priorText = prior ?? clean(clause).slice(0, 160);
        if (priorText && !reading.baseline_statements.includes(priorText)) {
          reading.baseline_statements.push(priorText);
        }
        reading.has_prior = true;
      }
    }

    if (hasHabitual || prior) {
      const statement = prior ?? clean(clause).slice(0, 180);
      if (statement && !reading.baseline_statements.includes(statement)) {
        reading.baseline_statements.push(statement);
      }
      reading.has_prior = true;
    }

    if (hasChange) {
      const statement = current ?? clean(clause).slice(0, 180);
      if (statement && !reading.change_statements.includes(statement)) {
        reading.change_statements.push(statement);
      }
      if (!reading.changed_domains.includes(domain)) reading.changed_domains.push(domain);
      reading.has_change = true;
    }

    if (prior && current) {
      reading.pairs.push({ prior, current, domain });
    }

    if (matchesAny(clause, ONSET_CUES) && (hasChange || hasHabitual)) {
      const span = clean(clause).slice(0, 160);
      if (!reading.onset_statements.includes(span)) reading.onset_statements.push(span);
    }
  }

  // Caregivers routinely split the comparison across sentences:
  // "Up until the fall he walked to the kitchen on his own. Now he needs the frame."
  // Adjacent prior-only and change-only clauses in the same domain form one pair.
  for (let i = 0; i < clauseFacts.length; i += 1) {
    const fact = clauseFacts[i]!;
    if (fact.prior && fact.current) continue; // already paired inside one clause
    const hasChangeSide = Boolean(fact.current) || fact.hasChange;
    if (!hasChangeSide || fact.prior) continue;
    for (let j = i - 1; j >= 0 && j >= i - 2; j -= 1) {
      const earlier = clauseFacts[j]!;
      if (!earlier.prior) continue;
      if (earlier.domain !== "general" && fact.domain !== "general" && earlier.domain !== fact.domain) {
        continue;
      }
      const nowSpan = clean(fact.current ?? clauseSpans[fact.index] ?? "").slice(0, 180);
      if (nowSpan.length < 4) break;
      reading.pairs.push({ prior: earlier.prior, current: nowSpan, domain: fact.domain });
      break;
    }
  }

  reading.quantity_comparisons = quantityComparisons(t);
  reading.has_quantity_change = reading.quantity_comparisons.length > 0;
  if (reading.has_quantity_change) {
    for (const q of reading.quantity_comparisons) {
      if (!reading.changed_domains.includes(q.domain)) reading.changed_domains.push(q.domain);
      if (!reading.change_statements.includes(q.difference_phrase)) {
        reading.change_statements.push(q.difference_phrase);
      }
    }
  }

  // A clause that carries both a prior and a turn marker is the strongest signal
  // available; promote its now-span over a weaker clause-level change statement.
  if (reading.pairs.length > 0) {
    const first = reading.pairs[0]!;
    if (first.current && !reading.change_statements.includes(first.current)) {
      reading.change_statements.unshift(first.current);
    }
    if (first.prior && !reading.baseline_statements.includes(first.prior)) {
      reading.baseline_statements.unshift(first.prior);
    }
  }

  return reading;
}

/**
 * Caregiver-legible "what is different from usual" lines from a reading.
 * Never invents a comparison when the text did not state one.
 */
export function baselineChangeLines(reading: BaselineReading, limit = 3): string[] {
  const out: string[] = [];
  for (const q of reading.quantity_comparisons) {
    const line = `${q.label.charAt(0).toUpperCase()}${q.label.slice(1)}: ${q.current} ${q.unit}, ${q.difference_phrase}`;
    if (!out.some((l) => l.toLowerCase() === line.toLowerCase())) out.push(line);
  }
  for (const c of reading.change_statements) {
    const line = clean(c).replace(/\.$/, "");
    if (line.length < 6) continue;
    if (out.some((l) => l.toLowerCase().includes(line.toLowerCase().slice(0, 30)))) continue;
    out.push(line);
    if (out.length >= limit) break;
  }
  return out.slice(0, limit);
}
