/**
 * Client-safe thread detection helpers (no ACS / Node fs).
 * Full ingest lives in thread-ingestion/index.ts (server pipeline).
 */

export const THREAD_SOURCE_EVIDENCE_PREFIX = "[thread-source]";

const MIN_FRAGMENT_LEN = 12;

/**
 * Detect long family chat / email paste that should split (G6 Decision B).
 * Short notes stay single-observation.
 * Requires newline structure — callers must pass unsanitized raw text.
 */
export function looksLikeCareThread(raw: string): boolean {
  const t = raw.replace(/\r\n/g, "\n").trim();
  if (t.length < 160) return false;

  const speakerBlocks = t.split(
    /\n(?=(?:\[[^\]]+\]\s*)?[A-Za-z][A-Za-z .'-]{0,40}:\s)/,
  );
  if (speakerBlocks.length >= 2) return true;

  const paras = t.split(/\n\s*\n/).filter((p) => p.trim().length >= MIN_FRAGMENT_LEN);
  if (paras.length >= 3) return true;

  const sentences = t.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length >= MIN_FRAGMENT_LEN);
  return t.length >= 400 && sentences.length >= 4;
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
  return lines[lines.length - 1] ?? rest;
}
