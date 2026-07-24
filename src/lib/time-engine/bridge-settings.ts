import { DEFAULT_SOLENOS_SETTINGS } from "../settings-governance/defaults";
import type { SolenOSSettings, TimeControl } from "../settings-governance/types";
import { DEFAULT_TIME_ENGINE, defaultUrgencyDecayFunction } from "./defaults";
import type { SolenOSTimeEngine } from "./types";

/**
 * Time Engine READS config from resolved settings — does not duplicate settings storage.
 */
export function readTimeEngineFromSettings(
  settings: SolenOSSettings | TimeControl | undefined,
): SolenOSTimeEngine {
  const timeControl: TimeControl =
    settings && "timeControl" in settings
      ? (settings as SolenOSSettings).timeControl
      : settings && "strictTimeHorizonMode" in settings
        ? (settings as TimeControl)
        : DEFAULT_SOLENOS_SETTINGS.timeControl;

  return {
    timezoneDetection: timeControl.timezoneDetection,
    coarseLocationEnabled: timeControl.coarseLocationEnabled,
    strictTimeHorizonMode: timeControl.strictTimeHorizonMode,
    timeHorizonModel: { ...timeControl.timeHorizonModel },
    urgencyDecayFunction: defaultUrgencyDecayFunction,
  };
}

export function mergeTimeEngineWithDefaults(
  partial?: Partial<Omit<SolenOSTimeEngine, "urgencyDecayFunction">> & {
    urgencyDecayFunction?: SolenOSTimeEngine["urgencyDecayFunction"];
  },
): SolenOSTimeEngine {
  return {
    ...DEFAULT_TIME_ENGINE,
    ...partial,
    timeHorizonModel: {
      ...DEFAULT_TIME_ENGINE.timeHorizonModel,
      ...(partial?.timeHorizonModel ?? {}),
    },
    urgencyDecayFunction: partial?.urgencyDecayFunction ?? defaultUrgencyDecayFunction,
  };
}
