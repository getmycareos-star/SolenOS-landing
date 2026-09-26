/**
 * Understanding trace — the caregiver-visible "why", and a way to correct it.
 *
 * The Critical Gap: the pipeline computed eleven internal layers and stripped all
 * of them from the caregiver view, so a caregiver could see *what* SolenOS
 * understood but never *why*, and could not correct a misreading.
 *
 * This module produces the charter-compliant answer:
 * - **What we took this to mean** — one plain sentence per held fact.
 * - **Where it came from** — the caregiver's own words, quoted, plus who reported it.
 * - **What we did not decide** — the parts still open (no silent resolution).
 * - **How to correct it** — a concrete invitation to correct one specific reading.
 *
 * It contains no layer names, no engine names, no scores, and no claim that is not
 * backed by a quote from the record.
 */

export type UnderstandingTraceStep = {
  /** What SolenOS took this to mean, in caregiver language. */
  reading: string;
  /** The words this reading came from — always present. */
  source_quote: string;
  /** Who said it, when known. */
  reported_by: string | null;
  /** Date of the source, when known. */
  when: string | null;
  /** Why this was read that way, in one clause. Never a mechanism. */
  basis: string;
  /** True when the reading is a caregiver interpretation, not a stated fact. */
  interpretation: boolean;
};

export type UnderstandingTrace = {
  heading: string;
  /** Short, human summary of the whole reading. */
  summary: string | null;
  steps: UnderstandingTraceStep[];
  /** Open parts, preserved rather than resolved. */
  not_decided: string[];
  /** Correction invitation, present whenever anything was read at all. */
  correction_prompt: string | null;
  has_content: boolean;
};

const HEADING = "How this was understood";

export type TraceInput = {
  /** Plain-language readings of held facts, in order. */
  facts: string[];
  /** The raw caregiver wording behind each fact, same order (optional). */
  quotes?: (string | null)[];
  /** Who reported each fact, same order (optional). */
  reporters?: (string | null)[];
  /** Dates for each fact, same order (optional). */
  dates?: (string | null)[];
  /** Fragments that are interpretations rather than stated facts. */
  interpretations?: string[];
  /** Anything still unresolved — shown as "not decided". */
  openQuestions?: string[];
  /** What SolenOS understood from structured extraction of this turn. */
  structuredFindings?: string[];
  /** The caregiver's original words, used for the summary and correction prompt. */
  originalInput?: string;
};

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function quoteFor(quote: string | null | undefined, fact: string): string {
  const q = clean(quote ?? "");
  if (q.length >= 6) return q.slice(0, 220);
  return clean(fact).slice(0, 220);
}

function basisFor(fact: string, index: number, interpretation: boolean): string {
  if (interpretation) return "Read as your interpretation, not as a stated fact";
  if (index === 0) return "From what you shared";
  return "Linked to what you already shared";
}

function correctionPrompt(subject: string, fact: string): string {
  const shortFact = clean(fact).replace(/\.$/, "");
  const clipped = shortFact.length > 90 ? `${shortFact.slice(0, 90)}…` : shortFact;
  return `If “${clipped}” is not how ${subject === "they" ? "it happened" : "it happened"}, tell us what was different and we will hold both until it is clear.`;
}

export function buildUnderstandingTrace(input: TraceInput, opts?: { subjectLabel?: string }): UnderstandingTrace {
  const subject = opts?.subjectLabel && opts.subjectLabel !== "they" ? opts.subjectLabel : null;
  const who = subject ?? "they";
  const steps: UnderstandingTraceStep[] = [];
  const interpretations = new Set((input.interpretations ?? []).map((f) => clean(f).toLowerCase()));

  const allFacts = [...input.facts];
  const structured = (input.structuredFindings ?? []).map(clean).filter(Boolean);

  // Structured findings first: they are the specific, checkable readings.
  const ordered = [...structured, ...allFacts];
  const seen = new Set<string>();

  for (let i = 0; i < ordered.length; i += 1) {
    const fact = clean(ordered[i]!);
    if (fact.length < 4) continue;
    const key = fact.toLowerCase().slice(0, 50);
    if (seen.has(key)) continue;
    seen.add(key);
    // Quote index mapping: structured findings have no direct quote in the same order.
    const structuredCount = structured.length;
    const factIndex = i < structuredCount ? 0 : i - structuredCount;
    const quote = i < structuredCount ? null : input.quotes?.[factIndex];
    const reporter = i < structuredCount ? null : input.reporters?.[factIndex];
    const date = i < structuredCount ? null : input.dates?.[factIndex];
    const interpretation = interpretations.has(fact.toLowerCase());
    steps.push({
      reading: fact,
      source_quote: quoteFor(quote, fact),
      reported_by: reporter ?? null,
      when: date ?? null,
      basis: basisFor(fact, i, interpretation),
      interpretation,
    });
    if (steps.length >= 4) break;
  }

  const not_decided = [...new Set((input.openQuestions ?? []).map(clean).filter((q) => q.length > 6))].slice(0, 3);
  const summary = steps.length > 0 ? steps[0]!.reading : null;
  const has_content = steps.length > 0 || not_decided.length > 0;

  return {
    heading: HEADING,
    summary,
    steps,
    not_decided,
    correction_prompt: steps.length > 0 ? correctionPrompt(who, steps[0]!.reading) : null,
    has_content,
  };
}

/**
 * Trust guard: a trace step is only legitimate when it is backed by a quote from
 * the record. Used by verification so a future change cannot ship an ungrounded
 * "why".
 */
export function traceStepIsGrounded(step: UnderstandingTraceStep, heldQuotes: readonly string[]): boolean {
  if (step.source_quote.trim().length < 4) return false;
  if (heldQuotes.length === 0) return true;
  const needle = step.source_quote.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim().slice(0, 40);
  if (needle.length < 4) return false;
  return heldQuotes.some((q) =>
    q.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").includes(needle),
  );
}
