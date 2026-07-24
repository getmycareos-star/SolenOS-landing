import {
  createEmptyCase,
  findCaseByAlias,
  getCase,
  listCases,
  upsertCase,
} from "./stores/case-store";
import type { Case } from "./types";

const RELATIONSHIP_PATTERNS: Array<{ relationship: string; patterns: RegExp[]; displayName: string }> = [
  {
    relationship: "Father",
    displayName: "Dad",
    patterns: [/\bdad\b/i, /\bfather\b/i, /\bpapa\b/i, /\bpop\b/i],
  },
  {
    relationship: "Mother",
    displayName: "Mom",
    patterns: [/\bmom\b/i, /\bmother\b/i, /\bmama\b/i, /\bmum\b/i],
  },
  {
    relationship: "Spouse",
    displayName: "Spouse",
    patterns: [/\bhusband\b/i, /\bwife\b/i, /\bspouse\b/i, /\bpartner\b/i],
  },
  {
    relationship: "Sibling",
    displayName: "Sibling",
    patterns: [/\bbrother\b/i, /\bsister\b/i],
  },
];

export type IdentifyCaseResult = {
  caseEntity: Case;
  identified: boolean;
  matchedAlias?: string;
  created: boolean;
};

/**
 * Resolve Case from caregiver language (care recipient / LO name).
 * Prefer alias match; otherwise create Case for strongest relationship cue.
 */
export function identifyCase(input: string, preferredCaseId?: string): IdentifyCaseResult {
  if (preferredCaseId) {
    const existing = getCase(preferredCaseId);
    if (existing) {
      return { caseEntity: existing, identified: true, created: false };
    }
  }

  // Match existing cases by kinship alias only — never auto-create Mom/Dad from notes (Locked A).
  for (const entry of RELATIONSHIP_PATTERNS) {
    if (!entry.patterns.some((p) => p.test(input))) continue;
    const byDisplay = findCaseByAlias(entry.displayName);
    if (byDisplay) {
      return {
        caseEntity: byDisplay,
        identified: true,
        matchedAlias: entry.displayName,
        created: false,
      };
    }
    const byRel = findCaseByAlias(entry.relationship);
    if (byRel) {
      return {
        caseEntity: byRel,
        identified: true,
        matchedAlias: entry.relationship,
        created: false,
      };
    }
  }

  const named = input.match(/\b([A-Z][a-z]+)(?:'s)?\b/);
  if (named?.[1] && !["I", "The", "He", "She", "They"].includes(named[1])) {
    const alias = named[1];
    const existing = findCaseByAlias(alias);
    if (existing) {
      return { caseEntity: existing, identified: true, matchedAlias: alias, created: false };
    }
  }

  const only = listCases();
  if (only.length === 1) {
    return { caseEntity: only[0]!, identified: true, matchedAlias: only[0]!.profile.displayName, created: false };
  }

  const fallback = upsertCase(
    createEmptyCase({
      displayName: "Care recipient",
      relationship: undefined,
    }),
  );
  return { caseEntity: fallback, identified: false, created: true };
}
