/** Copy patterns that frame caregivers as needing to manage, organize, or remember more. */

export const FORBIDDEN_COPY_PATTERNS = [
  /\bremember to\b/i,
  /\bremember everything\b/i,
  /\bremember more\b/i,
  /\bstay organized\b/i,
  /\bkeep (?:everything )?organized\b/i,
  /\bmanage your\b/i,
  /\bmanage more\b/i,
  /\bmanage everything\b/i,
  /\btrack everything\b/i,
  /\btrack all\b/i,
  /\bstay on top of everything\b/i,
  /\bproductivity\b/i,
  /\btask management\b/i,
  /\bcare management\b/i,
  /\bworkflow optimization\b/i,
  /\bget organized\b/i,
  /\borganize your care\b/i,
  /\bcoordination platform\b/i,
  /\bcare notes\b/i,
  /\bstored notes\b/i,
  /\bsaved a note\b/i,
  /\byour notes show\b/i,
  /\bprevious entries\b/i,
  /\bsupporting notes\b/i,
  /\bnote history\b/i,
] as const;

export const FORBIDDEN_COPY_PHRASES = [
  "remember to",
  "stay organized",
  "manage your",
  "manage more",
  "track everything",
  "remember more",
  "get organized",
  "task management",
  "care management",
] as const;

export function matchesForbiddenCopyPattern(text: string): boolean {
  return FORBIDDEN_COPY_PATTERNS.some((pattern) => pattern.test(text));
}

export function findForbiddenCopyViolations(text: string): string[] {
  return FORBIDDEN_COPY_PHRASES.filter((phrase) =>
    text.toLowerCase().includes(phrase.toLowerCase()),
  );
}
