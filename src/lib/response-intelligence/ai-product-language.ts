import { RESPONSE_AI_PRODUCT_LANGUAGE_BANS } from "./contract-constants";

export function containsAiProductLanguage(text: string): boolean {
  const lower = text.toLowerCase();
  return RESPONSE_AI_PRODUCT_LANGUAGE_BANS.some((p) => lower.includes(p));
}

export function assertNoAiProductLanguage(
  parts: readonly (string | null | undefined)[],
  label = "response",
): void {
  const blob = parts.filter(Boolean).join("\n");
  if (containsAiProductLanguage(blob)) {
    throw new Error(
      `Response Intelligence: AI product language leaked in ${label}: ${blob.slice(0, 200)}`,
    );
  }
}
