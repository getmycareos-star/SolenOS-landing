/**
 * Internal Clinical Situation Classification — reasoning only.
 * Never caregiver-facing labels, scores, dashboards, or diagnosis.
 *
 * SoT: docs/02-product/solenos-clinical-situation-classification.md
 * Doc examples are illustrations only — never product if-branches on scenario nouns.
 */

import {
  looksLikeContributorLoadFragment,
  looksLikeDisagreementPerspectiveFragment,
} from "../care-reality-extraction/classify";

export const CLINICAL_SITUATION_CLASSIFICATION_PURPOSE =
  "Internally classify what kind of care reality is changing — never show categories as medical labels or diagnoses.";

/** Engine-only category ids — never render in caregiver UI. */
export type ClinicalSituationCategoryId =
  | "cognitive_change"
  | "behavioral_change"
  | "safety_concern"
  | "medication_transition"
  | "functional_decline"
  | "nutrition_hydration_change"
  | "sleep_change"
  | "caregiver_strain"
  | "family_coordination"
  | "administrative_burden";

export type ClinicalSituationHit = {
  category: ClinicalSituationCategoryId;
  /** Engine-only certainty — never % in UI. */
  confidence: "low" | "medium" | "high";
  /** Short internal note — never shown to caregiver. */
  evidence_note: string;
  /** Impact priority 1 (highest) … 8 (lowest). */
  priority: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  /** True when this is secondary context (strain / family / admin). */
  is_context: boolean;
};

export type ClinicalSituationLink = {
  from: ClinicalSituationCategoryId;
  to: ClinicalSituationCategoryId;
  certainty: "possible" | "supported";
  note: string;
};

export type ClinicalSituationClassification = {
  hits: ClinicalSituationHit[];
  /** Highest-impact primary categories (excludes pure context unless only content). */
  primary: ClinicalSituationCategoryId[];
  context: ClinicalSituationCategoryId[];
  links: ClinicalSituationLink[];
  /** Caregiver-facing orientation — human language, no category names. */
  human_orientation: string | null;
  /** Engine: what matters most among primary hits. */
  priority_focus: ClinicalSituationCategoryId | null;
};

/** Caregiver UI leakage — reject if these appear. */
export const CLINICAL_CATEGORY_LEAKAGE_PATTERNS = [
  /\bclinical category detected\b/i,
  /\bcategory:\s*(?:cognitive|behavioral|safety|medication|functional)/i,
  /\brisk score:\s*\d/i,
  /\bpatient declining\b/i,
  /\bcognitive change\b.*\bdetected\b/i,
  /\bsituation category:\b/i,
  /\bdiagnosis:\s*(?:dementia|alzheimer)/i,
] as const;

export function containsClinicalCategoryLeakage(blob: string): boolean {
  return CLINICAL_CATEGORY_LEAKAGE_PATTERNS.some((p) => p.test(blob));
}

export function priorityForCategory(
  category: ClinicalSituationCategoryId,
): 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 {
  switch (category) {
    case "safety_concern":
      return 1;
    case "functional_decline":
      return 2;
    case "cognitive_change":
    case "behavioral_change":
      return 3;
    case "medication_transition":
      return 4;
    case "nutrition_hydration_change":
    case "sleep_change":
      return 5;
    case "administrative_burden":
      return 6;
    case "family_coordination":
      return 7;
    case "caregiver_strain":
      return 8;
    default:
      return 8;
  }
}

function isContextCategory(category: ClinicalSituationCategoryId): boolean {
  return (
    category === "caregiver_strain" ||
    category === "family_coordination" ||
    category === "administrative_burden"
  );
}

type Detector = {
  category: ClinicalSituationCategoryId;
  test: (t: string) => boolean;
  confidence: (t: string) => "low" | "medium" | "high";
  note: string;
};

/**
 * Structural detectors — discourse / care-domain families, not caregiver-facing keyword products.
 */
const DETECTORS: Detector[] = [
  {
    category: "cognitive_change",
    test: (t) =>
      /\b(?:confused|confusion|forget(?:ting|s|ful)?|memory|repeated(?:ly)? (?:ask|question)|keeps? asking|asking (?:the )?same|asking when|doesn'?t (?:know|recognize|recognise)|orientation|where .{0,20}(?:is|are)|who .{0,12}(?:is|am))\b/i.test(
        t,
      ),
    confidence: (t) =>
      /\b(?:repeated|keeps? asking|doesn'?t (?:know|recognize))\b/i.test(t)
        ? "high"
        : "medium",
    note: "cognitive / orientation discourse",
  },
  {
    category: "behavioral_change",
    test: (t) =>
      /\b(?:agitat|upset|withdrawn|withdrawal|personality|resist(?:s|ing|ance)?|refuses? (?:care|help)|mood|anxious|angry|becomes? upset)\b/i.test(
        t,
      ) &&
      !/\b(?:brother|sister|family) (?:thinks?|says)\b/i.test(t),
    confidence: () => "medium",
    note: "behavioral / emotional response discourse",
  },
  {
    category: "safety_concern",
    test: (t) =>
      /\b(?:fell|fall|fallen|wander|left (?:the )?(?:house|home)|trying to leave|tried to leave|unsafe|got lost|midnight|medication mistake|wrong (?:pill|dose))\b/i.test(
        t,
      ),
    confidence: (t) =>
      /\b(?:left (?:the )?(?:house|home)|fell|fall scare|wander)\b/i.test(t)
        ? "high"
        : "medium",
    note: "safety / unsafe-action discourse",
  },
  {
    category: "medication_transition",
    test: (t) =>
      /\b(?:medication|medicine|dose|dosage|pill|rx)\b/i.test(t) &&
      /\b(?:changed|change|stopped|started|new|discontinu|adjusted|after .{0,40}(?:medication|medicine))\b/i.test(
        t,
      ),
    confidence: () => "high",
    note: "medication change / transition discourse",
  },
  {
    category: "functional_decline",
    test: (t) =>
      /\b(?:used to|usually|every morning).{0,80}\b(?:cook|prepare|dress|walk|bathe|shower|independen)\b/i.test(
        t,
      ) ||
      /\b(?:can'?t|cannot|unable to|stopped).{0,40}\b(?:cook|dress|walk|bathe|shower|manage|prepare)\b/i.test(
        t,
      ) ||
      /\b(?:walking|dressing|cooking|personal care|independen).{0,40}\b(?:harder|decline|can'?t|cannot|stopped)\b/i.test(
        t,
      ),
    confidence: () => "medium",
    note: "daily function / independence discourse",
  },
  {
    category: "nutrition_hydration_change",
    test: (t) =>
      /\b(?:isn'?t eating|not eating|barely (?:eat|ate)|reduced (?:eating|appetite)|refusing food|drinking less|appetite|weight)\b/i.test(
        t,
      ) ||
      (/\b(?:eat|eating|food|meal|drink)\b/i.test(t) &&
        /\b(?:less|more|stopped|barely|refuses?)\b/i.test(t)),
    confidence: () => "medium",
    note: "nutrition / hydration discourse",
  },
  {
    category: "sleep_change",
    test: (t) =>
      /\b(?:sleep(?:s|ing)? more|sleep(?:s|ing)? less|sleeps? most of|nighttime|up all night|disrupted sleep|tired during the day)\b/i.test(
        t,
      ) ||
      (/\bsleep(?:s|ing)?\b/i.test(t) &&
        /\b(?:more|less|most of|all day|pattern)\b/i.test(t)),
    confidence: () => "medium",
    note: "sleep pattern discourse",
  },
  {
    category: "caregiver_strain",
    test: (t) =>
      looksLikeContributorLoadFragment(t) ||
      /\b(?:overwhelmed|exhausted|burned out|can'?t keep (?:up|track)|feeling alone|don'?t know what matters)\b/i.test(
        t,
      ),
    confidence: () => "medium",
    note: "caregiver load / strain discourse",
  },
  {
    category: "family_coordination",
    test: (t) =>
      looksLikeDisagreementPerspectiveFragment(t) ||
      /\b(?:brother|sister|family|sibling).{0,40}\b(?:thinks?|says|said|visits?|disagree|fine)\b/i.test(
        t,
      ) ||
      /\b(?:different|another) (?:opinion|perspective|view)\b/i.test(t),
    confidence: () => "medium",
    note: "family perspective / coordination discourse",
  },
  {
    category: "administrative_burden",
    test: (t) =>
      /\b(?:insurance|paperwork|forms?|referral|appointment|transportation|hospital forms?|nobody (?:has )?explained)\b/i.test(
        t,
      ),
    confidence: () => "medium",
    note: "admin / navigation discourse",
  },
];

function proposeLinks(hits: ClinicalSituationHit[]): ClinicalSituationLink[] {
  const ids = new Set(hits.map((h) => h.category));
  const links: ClinicalSituationLink[] = [];
  const push = (
    from: ClinicalSituationCategoryId,
    to: ClinicalSituationCategoryId,
    note: string,
  ) => {
    if (ids.has(from) && ids.has(to)) {
      links.push({ from, to, certainty: "possible", note });
    }
  };
  // Typical care-transition chains — relational, not causal claims; plain language for possible surface
  push(
    "medication_transition",
    "sleep_change",
    "A medication adjustment may be related to the sleep change — connection possible, not confirmed.",
  );
  push(
    "medication_transition",
    "cognitive_change",
    "A medication adjustment may be related to the confusion or memory change — connection possible, not confirmed.",
  );
  push(
    "sleep_change",
    "cognitive_change",
    "Sleep and confusion changes may be related — relationship possible; cause unclear.",
  );
  push(
    "cognitive_change",
    "safety_concern",
    "The safety concern may relate to recent confusion — understand the situation first.",
  );
  push(
    "functional_decline",
    "safety_concern",
    "The safety concern may relate to a change in daily independence.",
  );
  push(
    "nutrition_hydration_change",
    "functional_decline",
    "Eating or drinking changes may relate to daily function — relationship possible.",
  );
  return links;
}

/**
 * Human language from internal categories — never category names or scores.
 */
export function humanOrientationFromClinicalCategories(
  classification: Pick<
    ClinicalSituationClassification,
    "primary" | "context" | "links" | "priority_focus"
  >,
): string | null {
  const primary = classification.primary;
  if (primary.length === 0) {
    if (classification.context.length > 0) {
      return "Caregiver and family context are held. What is changing for the person receiving care is not yet clear from this capture alone.";
    }
    return null;
  }

  const phrases: string[] = [];
  const has = (id: ClinicalSituationCategoryId) => primary.includes(id);

  if (has("safety_concern")) phrases.push("a recent safety concern");
  if (has("cognitive_change")) phrases.push("increased confusion or memory change");
  if (has("behavioral_change")) phrases.push("a change in usual responses or behavior");
  if (has("functional_decline")) phrases.push("a change in daily independence");
  if (has("medication_transition")) phrases.push("a medication change");
  if (has("nutrition_hydration_change")) phrases.push("a change in eating or drinking");
  if (has("sleep_change")) phrases.push("a change in sleep");

  if (phrases.length === 0) return null;

  let line: string;
  if (phrases.length >= 2) {
    const biggest = phrases.slice(0, 3);
    line = `Several changes appear to have happened around the same period. The biggest changes are ${biggest.join(", ").replace(/, ([^,]*)$/, ", and $1")}.`;
  } else {
    line = `A meaningful change is held: ${phrases[0]}.`;
  }

  if (classification.links.length > 0) {
    line +=
      " It is still unclear whether these events are connected or what may explain them.";
  } else if (phrases.length >= 2) {
    line += " It is still unclear whether these events are connected.";
  }

  if (classification.context.includes("family_coordination")) {
    line +=
      " Different family perspectives are held as context, not as the main care situation.";
  } else if (classification.context.includes("caregiver_strain")) {
    line += " Caregiver load is held as context around the person's care reality.";
  }

  return line;
}

/**
 * Classify incoming caregiver text into internal situation categories.
 * Output is for reasoning + human translation — never raw category chrome.
 */
export function classifyClinicalSituations(params: {
  rawText: string;
  /** When true, family/strain may be primary only if no recipient categories exist. */
  allowContextAsPrimary?: boolean;
}): ClinicalSituationClassification {
  const t = params.rawText.trim();
  const hits: ClinicalSituationHit[] = [];

  if (!t) {
    return {
      hits: [],
      primary: [],
      context: [],
      links: [],
      human_orientation: null,
      priority_focus: null,
    };
  }

  for (const d of DETECTORS) {
    if (!d.test(t)) continue;
    const category = d.category;
    hits.push({
      category,
      confidence: d.confidence(t),
      evidence_note: d.note,
      priority: priorityForCategory(category),
      is_context: isContextCategory(category),
    });
  }

  // Deduplicate by category (keep highest confidence)
  const byCat = new Map<ClinicalSituationCategoryId, ClinicalSituationHit>();
  for (const h of hits) {
    const prev = byCat.get(h.category);
    if (!prev || confRank(h.confidence) > confRank(prev.confidence)) {
      byCat.set(h.category, h);
    }
  }
  const unique = [...byCat.values()].sort((a, b) => a.priority - b.priority);

  const recipientHits = unique.filter((h) => !h.is_context);
  const contextHits = unique.filter((h) => h.is_context);

  // Family coordination as primary only when entire message is coordination (no recipient hits)
  const primary =
    recipientHits.length > 0
      ? recipientHits.map((h) => h.category)
      : params.allowContextAsPrimary !== false && contextHits.length > 0
        ? contextHits.map((h) => h.category)
        : [];

  const context = contextHits.map((h) => h.category);
  const links = proposeLinks(unique);
  const priority_focus = primary[0] ?? null;

  const draft: ClinicalSituationClassification = {
    hits: unique,
    primary,
    context,
    links,
    human_orientation: null,
    priority_focus,
  };
  draft.human_orientation = humanOrientationFromClinicalCategories(draft);
  return draft;
}

function confRank(c: "low" | "medium" | "high"): number {
  return c === "high" ? 3 : c === "medium" ? 2 : 1;
}

/**
 * Prefer human orientation from clinical classification when it is richer than a thin line.
 */
export function preferClinicalHumanOrientation(params: {
  classification: ClinicalSituationClassification;
  fallback: string | null;
}): string | null {
  const human = params.classification.human_orientation;
  if (!human) return params.fallback;
  if (!params.fallback) return human;
  // Prefer clinical orientation when multiple primary categories (situation intelligence)
  if (params.classification.primary.length >= 2) return human;
  return params.fallback;
}
