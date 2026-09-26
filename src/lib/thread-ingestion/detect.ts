/**
 * Client-safe thread detection helpers (no ACS / Node fs).
 * Full ingest lives in thread-ingestion/index.ts (server pipeline).
 */

export const THREAD_SOURCE_EVIDENCE_PREFIX = "[thread-source]";

const MIN_FRAGMENT_LEN = 12;

/** Sent from my iPhone / Outlook separators that end a long paste. */
const MAIL_FOOTER = /(?:\n|^)(?:sent from my [\w\s]+|-{2,}\s*original message\s*-{2,}|on .{4,20}, .{0,40}wrote:)/i;

/** Quoted-reply markers: ">" prefixed lines, "On ... wrote:", ellipsis separators. */
const QUOTE_CUE = /(?:^|\n)\s*(?:>|\|)/;

/** Timestamps that commonly separate chat turns. */
const TIMESTAMP_LINE = /(?:^|\n)\s*(?:\d{1,2}[:.]\d{2}\s?(?:am|pm)?|\[\d{1,2}[:.]\d{2}\]|(?:mon|tues?|wed(?:nes)?|thurs?|fri|sat(?:ur)?|sun)[a-z]*\s+\d{1,2}|sent\s*:?\s*\d)/i;

/** Common caregiver / family speaker labels — "Mom:", "Dad:", "Sarah (sent):", "[John]", "John (iPhone):" */
const CAREGIVER_NAME_PATTERNS = [
  /\b(?:mom|dad|mommy|daddy|mother|father|sister|brother|niece|nephew|grandma|grandpa|grandmother|grandfather|aunt|uncle|cousin|daughter|son|wife|husband|partner|friend|caregiver|nurse|carer)\b/i,
  /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s*(?:\(.*?\)|\(sent\)|\(iphone\)|\(android\)|\(mobile\))?\s*:/,
  /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s*\(?:sent\)?\s*:/i,
  /\[\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s*\]\s*:/,
  /\b[A-Z][a-z]+\s*\(?:wrote|said|texted|messaged|replied|answered\)?\s*:/i,
];

function normalize(raw: string): string {
  return raw.replace(/\r\n/g, "\n").trim();
}

function countNonEmptyLines(text: string): number {
  return text.split("\n").filter((l) => l.trim().length > 0).length;
}

function countQuoted(text: string): number {
  return text.split("\n").filter((l) => /^\s*[>|]/.test(l)).length;
}

/**
 * Detect a long family chat / email paste that should split (G6 Decision B).
 * Short notes stay a single observation.
 *
 * Robustness (fragile single-signal heuristics rejected):
 * - speaker blocks: "Name:", "[Name] Name:", bracketed senders, "Name (sent):"
 * - paragraph blocks of real content
 * - quoted-reply structure (> lines, "On ... wrote:", "original message")
 * - timestamp-separated turns (whatsapp/ios/email)
 * - list-shaped care round-ups ("- took meds", "1. ate breakfast")
 * - a very long run of distinct sentences, with or without blank lines
 *
 * Requires unsanitized raw text from the caller.
 */
export function looksLikeCareThread(raw: string): boolean {
  const t = normalize(raw);
  if (t.length < 160) return false;

  // Speaker-labelled turns (2+).
  const speakerBlocks = t.split(
    /\n(?=(?:\[[^\]]+\]\s*)?[A-Za-z][A-Za-z .'-]{0,40}(?:\([^)]*\))?\s*:\s)/,
  );
  if (speakerBlocks.filter((b) => b.trim().length > 0).length >= 2) return true;

  // Caregiver-name-labelled turns (2+).
  const caregiverBlocks = t.split(
    /\n(?=(?:[A-Za-z][A-Za-z .'-]{0,40}\s*\(?:sent|iphone|android|mobile|wrote|said|texted|messaged|replied|answered\)?\s*\)\s*:)|(?:\[\s*[A-Za-z][A-Za-z .'-]{0,40}\s*\]\s*:))/i,
  );
  if (caregiverBlocks.filter((b) => b.trim().length > 0).length >= 2) return true;

  // Quoted-reply structure.
  if (countQuoted(t) >= 2 && countNonEmptyLines(t) >= 4) return true;
  if (/\bon .{3,40}\s+wrote:/i.test(t) && countNonEmptyLines(t) >= 3) return true;
  if (countQuoted(t) >= 1 && t.length >= 300) return true;

  // Content paragraphs.
  const paras = t.split(/\n\s*\n/).filter((p) => p.trim().length >= MIN_FRAGMENT_LEN);
  if (paras.length >= 3) return true;

  // Timestamp-separated turns.
  if (countNonEmptyLines(t) >= 4 && (t.match(TIMESTAMP_LINE)?.length ?? 0) >= 2) return true;

  // List-shaped round-ups.
  const bulletLines = t.split("\n").filter((l) => /^\s*(?:[-*•·]|\d+[.)])\s+\S/.test(l));
  if (bulletLines.length >= 3 && bulletLines.join(" ").length >= 60) return true;

  // Long single-blob paste: many distinct content sentences.
  const sentences = t
    .replace(MAIL_FOOTER, "\n")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= MIN_FRAGMENT_LEN);
  if (sentences.length >= 5 && t.length >= 320) return true;
  if (sentences.length >= 4 && t.length >= 400) return true;

  // Broad caregiver-family vocabulary in a long text — likely a shared care thread.
  if (t.length >= 280) {
    const caregiverHits = CAREGIVER_NAME_PATTERNS.filter((p) => p.test(t)).length;
    if (caregiverHits >= 2) return true;
    if (caregiverHits >= 1 && countNonEmptyLines(t) >= 5) return true;
  }

  return false;
}

/** Number of fragments a paste would split into (1 when not a thread). */
export function threadFragmentCount(raw: string): number {
  if (!looksLikeCareThread(raw)) return 1;
  const t = normalize(raw);
  const blocks = t
    .split(/\n(?=(?:\[[^\]]+\]\s*)?[A-Za-z][A-Za-z .'-]{0,40}(?:\([^)]*\))?\s*:\s)|(?<=[.!?])\s+(?=[A-Z])/)
    .map((b) => b.trim())
    .filter((b) => b.length >= MIN_FRAGMENT_LEN);
  return Math.max(2, blocks.length);
}

/**
 * Strip stored thread-source envelope for caregiver-facing display.
 * Never show [thread-source], classifications, or the full dump as a "chat summary".
 */
export function caregiverFacingFragmentText(rawObservationText: string): string {
  const t = rawObservationText.trim();
  if (!t.includes(THREAD_SOURCE_EVIDENCE_PREFIX)) return t;

  // Canonical: prefix … --- … fragment
  if (/\n---\n/.test(t)) {
    const parts = t.split(/\n---\n/);
    return (parts[parts.length - 1] ?? t).trim();
  }

  // Truncated / pointer forms: drop prefix line(s), keep remainder
  let rest = t;
  if (rest.startsWith(THREAD_SOURCE_EVIDENCE_PREFIX)) {
    rest = rest.slice(THREAD_SOURCE_EVIDENCE_PREFIX.length).trim();
  }
  rest = rest.replace(/^thr_[a-z0-9_]+\s*/i, "").trim();
  if (!rest) return "";
  const lines = rest.split(/\n/).map((l) => l.trim()).filter(Boolean);
  // Drop leading quote/envelope lines; keep the last human-written line.
  const human = lines.filter((l) => !/^(?:from|to|sent|subject)\s*:/i.test(l));
  return (human[human.length - 1] ?? lines[lines.length - 1] ?? rest).trim();
}
