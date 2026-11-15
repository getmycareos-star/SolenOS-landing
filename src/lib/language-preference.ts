export type SolenOSUiLanguage = "en" | "es" | "fr";

export const SOLENOS_UI_LANGUAGES = ["en", "es", "fr"] as const satisfies readonly SolenOSUiLanguage[];

export function isSolenOSUiLanguage(value: unknown): value is SolenOSUiLanguage {
  return typeof value === "string" && (SOLENOS_UI_LANGUAGES as readonly string[]).includes(value);
}

export function coerceSolenOSUiLanguage(value: unknown): SolenOSUiLanguage {
  return isSolenOSUiLanguage(value) ? value : "en";
}
