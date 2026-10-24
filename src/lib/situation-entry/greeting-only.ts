/**
 * A pure greeting/social exchange is conversation, not care evidence.
 * This classifies the input only; the Companion model generates the reply.
 */
const GREETING_ONLY_PATTERNS = [
  /^(?:hi|hello|hey|hiya|howdy)[.!?,\s]*$/i,
  /^(?:good\s+)?(?:morning|afternoon|evening|night)[.!?,\s]*$/i,
  /^(?:how\s+are\s+you(?:\s+doing)?|how'?s\s+it\s+going|what'?s\s+up|how\s+have\s+you\s+been)[.!?,\s]*$/i,
  /^(?:thank\s+you|thanks|thank\s+you\s+so\s+much|you'?re\s+welcome|nice\s+to\s+meet\s+you)[.!?,\s]*$/i,
];

export function isGreetingOnlyInput(input: string): boolean {
  const normalized = input.trim().replace(/\s+/g, " ");
  if (!normalized || normalized.length > 100) return false;
  return GREETING_ONLY_PATTERNS.some((pattern) => pattern.test(normalized));
}
