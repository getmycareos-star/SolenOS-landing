import type { Issue } from "./types";

/**
 * STEP 1 — Issue extraction (internal only).
 * Heuristic MVP: split unstructured caregiver text into atomic issues.
 * No ranking. LLM-assisted extraction may replace heuristics later;
 * ranking/sort remain deterministic regardless of extraction source.
 */

const SPLIT_PATTERN =
  /(?:\n+|(?<=[.!?])\s+|\s*;\s*|\s+and\s+(?=[A-Z])|\s*,\s*(?=and\s)|(?:^|\s)(?:also|plus|then)\s+)/i;

const NOISE = /^(?:also|and|then|plus|also,|well,|so,|anyway)\s+/i;

function slugId(title: string, index: number): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `issue-${index}-${slug || "item"}`;
}

function cleanChunk(raw: string): string {
  return raw.replace(NOISE, "").replace(/\s+/g, " ").trim().replace(/[.!?,;]+$/, "");
}

/**
 * Extract atomic issues from caregiver input.
 * Prefer comma/semicolon lists and conjunctive clauses when present.
 */
export function extractIssues(input: string): Issue[] {
  const text = input.replace(/\s+/g, " ").trim();
  if (!text) return [];

  // Prefer enumeration-style lists (A, B, and C) when multiple commas present.
  const listLike = text.includes(",") && (text.match(/,/g)?.length ?? 0) >= 2;
  let chunks: string[];

  if (listLike) {
    chunks = text
      .split(/,|\band\b/i)
      .map(cleanChunk)
      .filter((c) => c.length >= 8);
  } else {
    chunks = text
      .split(SPLIT_PATTERN)
      .map(cleanChunk)
      .filter((c) => c.length >= 8);
  }

  // Deduplicate near-identical titles; fallback to whole input as one issue.
  const seen = new Set<string>();
  const issues: Issue[] = [];
  for (const chunk of chunks) {
    const key = chunk.toLowerCase().slice(0, 48);
    if (seen.has(key)) continue;
    seen.add(key);
    const title =
      chunk.length > 90 ? `${chunk.slice(0, 87).trim()}…` : chunk;
    issues.push({
      id: slugId(title, issues.length),
      title,
      /** Local context only — never the full multi-issue dump (avoids score bleed). */
      context: chunk.slice(0, 240),
    });
  }

  if (issues.length === 0) {
    issues.push({
      id: "issue-0-input",
      title: text.length > 90 ? `${text.slice(0, 87).trim()}…` : text,
      context: text.slice(0, 400),
    });
  }

  return issues;
}
