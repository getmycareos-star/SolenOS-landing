import type { AttentionLane, AttentionSituation, CompetingAttentionResult } from "./types";

/**
 * Structural competing-attention — clause count / distinct threads.
 * NOT phrase-triggered product logic (no fall→emergency, confused→category).
 */
function splitClauses(text: string): string[] {
  return text
    .split(/[.!?;\n]+|(?:\s+and\s+(?=[A-Z]))/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 12);
}

function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3),
  );
}

function overlapRatio(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let n = 0;
  for (const w of a) if (b.has(w)) n += 1;
  return n / Math.min(a.size, b.size);
}

/** Caregiver-load framing — not a separate care thread. */
function isCaregiverLoadClause(clause: string): boolean {
  const t = clause.toLowerCase();
  return (
    /\bdon'?t (even )?know where to start\b/.test(t) ||
    /\bdon'?t know what to do\b/.test(t) ||
    /\boverwhelmed|exhausted\b/.test(t) ||
    /\btired of (trying to )?remember\b/.test(t) ||
    /\bcarrying (too )?much\b/.test(t) ||
    /\bnobody else (sees|notices)\b/.test(t)
  );
}

/**
 * When several distinct threads appear in one note, orient as situations — never a task list.
 */
export function prioritizeCompetingAttention(rawText: string): CompetingAttentionResult {
  const text = rawText.trim();
  if (!text) {
    return { is_competing: false, situations: [], orientation: null };
  }

  const clauses = splitClauses(text);
  if (clauses.length < 2) {
    return { is_competing: false, situations: [], orientation: null };
  }

  const distinct: string[] = [];
  for (const c of clauses) {
    const t = tokens(c);
    const similar = distinct.some((d) => overlapRatio(t, tokens(d)) >= 0.55);
    if (!similar) distinct.push(c);
  }

  if (distinct.length < 2) {
    return { is_competing: false, situations: [], orientation: null };
  }

  // Load framing + one care concern is one situation — not competing threads.
  const careClauses = distinct.filter((c) => !isCaregiverLoadClause(c));
  if (careClauses.length < 2) {
    return { is_competing: false, situations: [], orientation: null };
  }

  const situations: AttentionSituation[] = careClauses.slice(0, 3).map((excerpt, i) => {
    const lane: AttentionLane =
      i === 0 ? "care_monitoring" : i === 1 ? "upcoming" : "administrative";
    return {
      lane,
      status: "Needs attention in turn — not all at once",
      excerpt: excerpt.length > 100 ? `${excerpt.slice(0, 97).trim()}…` : excerpt,
    };
  });

  const careText = careClauses.join(" ");
  if (
    /\?/.test(careText) ||
    (/\b(not sure|unclear)\b/i.test(careText) &&
      !/\bdon'?t (even )?know where to start\b/i.test(careText))
  ) {
    situations.push({
      lane: "uncertain",
      status: "Still unclear",
      excerpt: "Something important is not held yet.",
    });
  }

  return {
    is_competing: true,
    situations: situations.slice(0, 3),
    orientation:
      "More than one care concern is held at once — kept as separate threads so nothing is forced together.",
  };
}

/** Caregiver-facing lines — short held excerpts, never “Open thread N” chrome. */
export function formatCompetingSituationLines(
  result: CompetingAttentionResult,
): string[] {
  if (!result.is_competing) return [];
  return result.situations.slice(0, 3).map((s) => {
    if (s.lane === "uncertain") {
      return `Still unclear: ${s.excerpt}`;
    }
    const excerpt = s.excerpt.trim();
    return excerpt.endsWith(".") ? excerpt : `${excerpt}.`;
  });
}
