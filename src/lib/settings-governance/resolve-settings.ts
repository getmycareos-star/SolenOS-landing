import { getTelemetryStore } from "../telemetry-persistence/server";
import { DEFAULT_SOLENOS_SETTINGS } from "./defaults";
import { getUserGovernanceSettings, mergeWithDefaultSettings } from "./persistence";
import { parseSolenOSSettings } from "./schema";
import type { SolenOSSettings } from "./types";

export interface ResolveUserSettingsParams {
  telemetry_user_id?: string;
  governance_settings?: unknown;
}

/**
 * Resolve governance settings: explicit request override → persisted user settings → default.
 * Settings are never passed to reasoning — only applied post-reasoning.
 */
export async function resolveUserSettings(
  params: ResolveUserSettingsParams,
): Promise<SolenOSSettings> {
  if (params.governance_settings !== undefined && params.governance_settings !== null) {
    if (typeof params.governance_settings === "object") {
      return mergeWithDefaultSettings(
        params.governance_settings as Partial<SolenOSSettings>,
      );
    }
    return parseSolenOSSettings(params.governance_settings);
  }

  if (params.telemetry_user_id) {
    const store = await getTelemetryStore();
    const persisted = await store.getUserGovernanceSettings(params.telemetry_user_id);
    if (persisted) {
      return persisted;
    }
    return getUserGovernanceSettings(params.telemetry_user_id);
  }

  return { ...DEFAULT_SOLENOS_SETTINGS };
}
