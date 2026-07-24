import { DEFAULT_SOLENOS_SETTINGS } from "./defaults";
import { mergeWithDefaultSettings, parseSolenOSSettings, SolenOSSettingsSchema } from "./schema";
import type { SolenOSSettings } from "./types";

/** In-memory governance settings store keyed by telemetry user id. */
const settingsByUserId = new Map<string, SolenOSSettings>();

export function getDefaultSettings(): SolenOSSettings {
  return mergeWithDefaultSettings(undefined);
}

export function getUserGovernanceSettings(userId: string): SolenOSSettings {
  return settingsByUserId.get(userId) ?? getDefaultSettings();
}

export function setUserGovernanceSettings(
  userId: string,
  settings: SolenOSSettings,
): SolenOSSettings {
  const parsed = parseSolenOSSettings(settings);
  settingsByUserId.set(userId, parsed);
  return parsed;
}

export function updateUserGovernanceSettings(
  userId: string,
  partial: Partial<SolenOSSettings>,
): SolenOSSettings {
  const current = getUserGovernanceSettings(userId);
  const merged = mergeWithDefaultSettings({ ...current, ...partial });
  settingsByUserId.set(userId, merged);
  return merged;
}

export function clearUserGovernanceSettings(userId: string): void {
  settingsByUserId.delete(userId);
}

/** Reset in-memory store — for tests only. */
export function resetGovernanceSettingsStore(): void {
  settingsByUserId.clear();
}

export { DEFAULT_SOLENOS_SETTINGS, SolenOSSettingsSchema, parseSolenOSSettings, mergeWithDefaultSettings };
