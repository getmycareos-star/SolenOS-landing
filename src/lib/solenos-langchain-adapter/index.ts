import { buildSolenOSPrompt } from "./prompt";
import { SOLENOS_SYSTEM_PROMPT } from "./system-prompt";
import { DEFAULT_SOLENOS_LANGUAGE } from "../multilingual-execution";
import type { SolenOSLanguage } from "../multilingual-execution/types";

const RETIRED_INFERENCE_MESSAGE =
  "Direct frontend model inference is retired. Use authenticated SolenOS backend routes; they apply the shared Companion identity and safety contract.";

export { extractRawLLMText } from "./raw-text";

/**
 * Retired compatibility entry point. Kept only so old imports fail explicitly
 * rather than silently opening a second, ungrounded model path.
 */
export async function runSolenOSMvpLLM(
  _input: string,
  _extraUserContent?: string,
): Promise<string> {
  throw new Error(RETIRED_INFERENCE_MESSAGE);
}

/** @deprecated Direct frontend inference is retired; use authenticated backend routes. */
export async function runSolenOSLLM(
  _input: string,
  _context?: unknown,
  _userLanguage: SolenOSLanguage = DEFAULT_SOLENOS_LANGUAGE,
): Promise<string> {
  throw new Error(RETIRED_INFERENCE_MESSAGE);
}

export { buildSolenOSPrompt } from "./prompt";
export {
  SOLENOS_SYSTEM_PROMPT,
  SOLENOS_SCHEMA_FIELD_NAMES,
  SYSTEM_PROMPT_SPEC_MARKERS,
} from "./system-prompt";
export {
  resolveSolenOSLLMProvider,
  resolveMvpLLMProvider,
} from "./model";
