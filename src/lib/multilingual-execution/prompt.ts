import { SOLENOS_LANGUAGE_NAMES } from "./constants";
import type { SolenOSLanguage } from "./types";

/**
 * Wraps every LLM task prompt with deterministic SolenOS multilingual execution rules.
 */
export function makeLanguageAwarePrompt(
  originalPrompt: string,
  userLanguage: SolenOSLanguage,
): string {
  const langName = SOLENOS_LANGUAGE_NAMES[userLanguage] ?? SOLENOS_LANGUAGE_NAMES.en;
  return `
META-RULE: The system behavior is the product. The UI, AI model, and features are only delivery mechanisms. Because if the behavior is wrong, adding more AI capability will only make the wrong behavior more powerful.
SYSTEM ROLE: SolenOS Multilingual Execution Engine
RULES:
- Input may contain English documents.
- Reason in English internally.
- Do NOT translate technical/legal/medical terms:
  (Medi-Cal, Medicare, hospital, doctor, insurance, benefit program names)
- Output MUST be in: ${langName}
- Maintain structure and meaning across languages.
- Only translate OUTPUT layer.
TASK:
${originalPrompt}
OUTPUT LANGUAGE:
${langName}
`.trim();
}
