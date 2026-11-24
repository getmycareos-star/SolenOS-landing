/**
 * Retired frontend inference adapter.
 *
 * All caregiver inference must go through authenticated SolenOS backend routes,
 * which apply the shared model-independent identity, personality, evidence,
 * privacy, and safety contracts. This module deliberately exposes no provider.
 */

const RETIRED_INFERENCE_MESSAGE =
  "Direct frontend model inference is retired. Use authenticated SolenOS backend routes; they apply the shared Companion identity and safety contract.";

export type SolenOSLLMProvider = never;
export type MvpLLMProvider = never;

export function resolveMvpLLMProvider(): null {
  return null;
}

/** Compatibility alias. Frontend inference is permanently disabled. */
export function resolveSolenOSLLMProvider(): null {
  return null;
}

export function createOllamaChatModel(): never {
  throw new Error(RETIRED_INFERENCE_MESSAGE);
}

export function createMvpChatModel(): never {
  throw new Error(RETIRED_INFERENCE_MESSAGE);
}

export function createSolenOSChatModel(): never {
  throw new Error(RETIRED_INFERENCE_MESSAGE);
}
