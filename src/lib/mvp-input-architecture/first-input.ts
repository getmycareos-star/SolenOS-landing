/**
 * First-input contract — content is unknown; messiness is predictable.
 * Any first message may be structured, messy, or extra messy — never wait to classify topic.
 */

export const INPUT_MESSINESS_LEVELS = ["structured", "messy", "extra_messy"] as const;
export type InputMessinessLevel = (typeof INPUT_MESSINESS_LEVELS)[number];

export const FIRST_INPUT_INVARIANTS = [
  "caregiver_words_are_source_of_truth_for_display",
  "never_replace_user_text_with_internal_signal_names",
  "capture_always_succeeds_interpretation_may_degrade",
  "uncertainty_is_human_questions_not_schema_field_names",
  "first_output_is_short_not_engine_dump",
] as const;

const PASTE_MARKERS =
  /\b(fwd:|forwarded|pasted from|group chat|sent from my|via whatsapp|copied from)\b/i;
const FRAGMENT = /^[\w\s]{0,12}$/i;
const MULTI_CLAUSE = /[.!?].+[.!?]/;
const PRONOUN_ONLY = /^(he|she|they|it)\b/i;

/** Classify how organized the input is — not what clinical topic it mentions. */
export function classifyInputMessiness(text: string): InputMessinessLevel {
  const trimmed = text.trim();
  if (!trimmed) return "extra_messy";

  const words = trimmed.split(/\s+/).filter(Boolean);
  const hasTime = /\b(today|yesterday|last week|\d{1,2}[/-]\d|am|pm|morning|night)\b/i.test(
    trimmed,
  );
  const hasSubject = /\b(mom|dad|mother|father|parent|patient|grandma|grandpa)\b/i.test(trimmed);
  const hasClearClause = trimmed.length >= 24 && /[.!?]/.test(trimmed) && hasSubject;

  if (words.length >= 12 && hasTime && hasSubject && (hasClearClause || MULTI_CLAUSE.test(trimmed))) {
    return "structured";
  }

  const chaosScore =
    (words.length < 5 ? 2 : 0) +
    (PASTE_MARKERS.test(trimmed) ? 1 : 0) +
    (PRONOUN_ONLY.test(trimmed) && !hasSubject ? 2 : 0) +
    (/\b(that|this|after that|wasn't doing well)\b/i.test(trimmed) ? 2 : 0) +
    (trimmed.includes("\n\n") ? 1 : 0) +
    (FRAGMENT.test(trimmed) ? 2 : 0);

  if (chaosScore >= 3) return "extra_messy";
  if (chaosScore >= 1 || words.length < 8 || !hasTime) return "messy";
  return "structured";
}

export function isGenericSignalText(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return (
    normalized.endsWith(" signal") ||
    normalized === "observation signal" ||
    normalized === "health deterioration signal" ||
    normalized === "follow up signal" ||
    normalized === "financial issue signal"
  );
}

export function isBareSchemaField(text: string): boolean {
  const t = text.trim().toLowerCase().replace(/^can you clarify:\s*/i, "");
  return (
    t === "time" ||
    t === "entity" ||
    t === "severity" ||
    t === "consequence" ||
    t === "what_changed" ||
    t === "when" ||
    t === "partial signal" ||
    t === "partial_signal"
  );
}

/** Strip stray quotes / smart quotes so display does not show ""text. */
export function sanitizeCaregiverDisplayText(text: string): string {
  return text
    .trim()
    .replace(/^["“”'`]+/, "")
    .replace(/["“”'`]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Terms that must never appear in caregiver-facing UI. */
export const CAREGIVER_FORBIDDEN_UI_TERMS = [
  "ambiguous_extraction",
  "partial_signal",
  "partial signal",
  "edge_state",
  "structural_risk",
  "reasoning_chain",
  "system_layers",
  "condensed_triage",
  "inference_pipeline",
  "extraction_status",
  "parser_output",
  "observation signal",
  "crisis mode",
  "low_confidence",
  "freshness window",
  "careevent",
  "care_event",
  "policyengine",
  "policy engine",
] as const;

const CAREGIVER_ERROR_FALLBACK =
  "Something went wrong while preserving this. You can try again.";

/**
 * Sanitize API / pipeline errors before showing them in the entry loop.
 * Engine tokens (CareEvent, PolicyEngine, …) never reach caregivers.
 */
export function sanitizeCaregiverErrorMessage(raw: string | null | undefined): string {
  if (!raw?.trim()) return CAREGIVER_ERROR_FALLBACK;
  let t = sanitizeCaregiverDisplayText(raw);

  const known: Array<[RegExp, string]> = [
    [
      /consent required before careevent creation\.?/i,
      "Accept the privacy terms so SolenOS can add this to the care record.",
    ],
    [
      /consent required before care data can be recorded\.?/i,
      "Accept the privacy terms so SolenOS can add this to the care record.",
    ],
    [
      /insufficient for a complete careevent\.?/i,
      "This was understood, but a few details would help complete the record.",
    ],
    [
      /preliminary careevent created/i,
      "Added to the record — a little more detail would strengthen continuity.",
    ],
    [
      /medical advice requests cannot be processed as care events\.?/i,
      "SolenOS preserves what happened — it cannot give medical advice or tell you what to do clinically.",
    ],
    [
      /no careevent without policyengine/i,
      "Privacy terms must be accepted before care can be recorded.",
    ],
    [
      /could not structure situation\.?/i,
      "Could not add this to the care record yet. You can try again.",
    ],
  ];
  for (const [pattern, replacement] of known) {
    if (pattern.test(t)) return replacement;
  }

  t = t
    .replace(/\bCareEvents?\b/gi, "care record entry")
    .replace(/\bcare_events?\b/gi, "care record entry")
    .replace(/\bPolicyEngine\b/gi, "privacy check")
    .replace(/\bpolicy engine\b/gi, "privacy check");

  if (CAREGIVER_FORBIDDEN_UI_TERMS.some((term) => t.toLowerCase().includes(term.toLowerCase()))) {
    return CAREGIVER_ERROR_FALLBACK;
  }
  return t || CAREGIVER_ERROR_FALLBACK;
}

export function isCaregiverSafeDisplayText(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  const lower = t.toLowerCase();
  if (CAREGIVER_FORBIDDEN_UI_TERMS.some((term) => lower.includes(term.toLowerCase()))) {
    return false;
  }
  if (/^(entity|time|severity|consequence|unclear reference)$/i.test(t)) return false;
  if (/\bprovisional:\s*/i.test(t)) return false;
  if (/\d{1,3}%/.test(t) && /confidence|complete|fresh|sure/i.test(t)) return false;
  if (/^\d{1,3}%$/.test(t)) return false;
  return true;
}

/** Turn engine missing-field tokens into caregiver-facing questions. */
export function humanizeUncertaintyForCaregiver(field: string): string {
  let t = field.trim();
  t = t.replace(/^can you clarify:\s*/i, "").trim();
  const lower = t.toLowerCase().replace(/\?+$/, "").trim();

  if (lower === "time" || lower === "when") return "When did this start or happen?";
  if (lower === "entity") return "Who is this about?";
  if (lower === "severity") return "How serious does this seem right now?";
  if (lower === "consequence") return "What happened as a result?";
  if (lower === "what_changed") return "What specifically changed?";
  if (lower === "who is he" || lower === "who is they") return "Who is this about?";
  if (lower === "unclear reference") return "Who or what does this refer to?";
  if (lower === "partial signal" || lower === "partial_signal") {
    return "What else should we know about this situation?";
  }
  if (lower.startsWith("provisional:")) {
    const rest = sanitizeCaregiverDisplayText(t.replace(/^provisional:\s*/i, ""));
    const cleaned = rest.replace(/\s*\((low_confidence|ambiguous_extraction|partial_extraction)\)\s*$/i, "");
    return cleaned ? `Still confirming: ${cleaned}` : "Still confirming details from your note";
  }
  if (lower.startsWith("still confirming:")) {
    const rest = sanitizeCaregiverDisplayText(t.replace(/^still confirming:\s*/i, ""));
    const cleaned = rest.replace(/\s*\((low_confidence|ambiguous_extraction|partial_extraction)\)\s*$/i, "");
    return cleaned ? `Still confirming: ${cleaned}` : "Still confirming details from your note";
  }
  if (lower.startsWith("when this started")) return "When did this start or happen?";
  if (lower.startsWith("additional context")) return "What else should we know about this situation?";
  if (isBareSchemaField(lower)) return humanizeUncertaintyForCaregiver(lower);
  if (t.includes("?") && !isBareSchemaField(t.replace(/\?+$/, "").trim())) return t;
  return sanitizeCaregiverDisplayText(t);
}

/** Caregiver-safe line: humanize then drop unsafe leftovers. */
export function toCaregiverFacingLine(raw: string): string | null {
  if (!raw.trim()) return null;
  const human = humanizeUncertaintyForCaregiver(raw);
  if (!isCaregiverSafeDisplayText(human)) return null;
  return human;
}

export function dedupeCaregiverFacingLines(lines: string[], max = 6): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    const key = line.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(line.trim());
    if (out.length >= max) break;
  }
  return out;
}

/** Best-effort caregiver words from events — never internal signal jargon. */
export function resolveCaregiverWords(
  events: ReadonlyArray<{
    raw_input: string;
    attributes?: Record<string, unknown>;
  }>,
  fallbackRaw?: string,
): string | null {
  for (const event of events) {
    const fromAttr =
      typeof event.attributes?.source_situation_text === "string"
        ? event.attributes.source_situation_text.trim()
        : "";
    const candidate = sanitizeCaregiverDisplayText(fromAttr || event.raw_input);
    if (candidate.length >= 3 && !isGenericSignalText(candidate)) {
      return candidate.slice(0, 400);
    }
  }
  const fallback = sanitizeCaregiverDisplayText(fallbackRaw ?? "");
  if (fallback.length >= 3 && !isGenericSignalText(fallback)) {
    return fallback.slice(0, 400);
  }
  return null;
}

/**
 * Past-tense / already-handled care reports are continuity capture,
 * not live crisis triage — unless explicit critical danger language is present.
 *
 * Prefer strong past + care-already-sought. Weak "this morning" alone does not
 * suppress an acute fall with head injury happening now.
 */
export function isRetrospectiveCareReport(text: string): boolean {
  const t = text.toLowerCase();
  const strongPast =
    /\b(yesterday|last night|last week|last month|a few days ago|the other day|earlier today)\b/i.test(
      t,
    );
  const careAlreadySought =
    /\b(went to|took (?:him|her|them) to|already (?:went|took|called|at|in)|seen (?:at|by)|ambulance (?:came|was called))\b/i.test(
      t,
    ) ||
    (/\b(urgent care|emergency room|\ber\b)\b/i.test(t) &&
      /\b(went|took|already|yesterday|last)\b/i.test(t));
  const resolved =
    /\b((?:she'?s|he'?s|they'?re) fine|all fine now|feeling better|back home now)\b/i.test(t);
  return strongPast || careAlreadySought || resolved;
}

export function isImmediateDangerLanguage(text: string): boolean {
  return (
    /\b(not breathing|can't breathe|cannot breathe|unconscious|passed out|seizure|stroke|911|bleeding heavily|won't wake|still on the (?:floor|ground))\b/i.test(
      text,
    )
  );
}
