import { DEFAULT_SOLENOS_LANGUAGE, SOLENOS_LANGUAGES } from "./constants";
import type { SolenOSLanguage } from "./types";

export function isSolenOSLanguage(value: unknown): value is SolenOSLanguage {
  return (
    typeof value === "string" &&
    (SOLENOS_LANGUAGES as readonly string[]).includes(value)
  );
}

export function coerceSolenOSLanguage(value: unknown): SolenOSLanguage {
  return isSolenOSLanguage(value) ? value : DEFAULT_SOLENOS_LANGUAGE;
}
