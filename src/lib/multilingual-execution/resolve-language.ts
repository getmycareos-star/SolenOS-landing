import { DEFAULT_SOLENOS_LANGUAGE } from "./constants";
import { coerceSolenOSLanguage } from "./validate-language";
import type { SolenOSLanguage } from "./types";
import { getTelemetryStore } from "../telemetry-persistence/server";

export interface ResolveUserLanguageParams {
  telemetry_user_id?: string;
  language_preference?: unknown;
}

/**
 * Resolve execution language: explicit request override → persisted user preference → default.
 */
export async function resolveUserLanguage(
  params: ResolveUserLanguageParams,
): Promise<SolenOSLanguage> {
  if (params.language_preference !== undefined) {
    return coerceSolenOSLanguage(params.language_preference);
  }

  if (params.telemetry_user_id) {
    const store = await getTelemetryStore();
    const persisted = await store.getUserLanguagePreference(params.telemetry_user_id);
    if (persisted) {
      return persisted;
    }
  }

  return DEFAULT_SOLENOS_LANGUAGE;
}
