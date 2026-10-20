/**
 * Emphasize action verbs in matters-now / follow-up copy for CLARITY surface.
 * Returns React-safe parts: plain text with optional strong verb spans marked.
 */

const ACTION_VERBS = [
  "CALL",
  "CHECK",
  "CONFIRM",
  "CONTACT",
  "ASK",
  "BRING",
  "MONITOR",
  "DOCUMENT",
  "SCHEDULE",
  "VERIFY",
] as const;

export type EmphasizedPart = { text: string; strong: boolean };

export function emphasizeActionVerbs(input: string): EmphasizedPart[] {
  if (!input.trim()) return [];

  const pattern = new RegExp(`\\b(${ACTION_VERBS.join("|")})\\b`, "gi");
  const parts: EmphasizedPart[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(input)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: input.slice(lastIndex, match.index), strong: false });
    }
    parts.push({ text: match[0].toUpperCase(), strong: true });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < input.length) {
    parts.push({ text: input.slice(lastIndex), strong: false });
  }

  return parts.length > 0 ? parts : [{ text: input, strong: false }];
}

/** Condensed left-panel summary for CONTINUITY. */
export function condenseEventSummary(rawInput: string, happening: string): string {
  const source = rawInput.trim() || happening.trim();
  if (source.length <= 280) return source;
  return `${source.slice(0, 277).trimEnd()}…`;
}
