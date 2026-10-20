import { DEFAULT_TIME_HORIZON_MODEL } from "../settings-governance/contract-constants";
import { URGENCY_DECAY_LAMBDA } from "./contract-constants";
import type { SolenOSTimeEngine, TimeInputSignals, UrgencyDecayFunction } from "./types";

export const defaultUrgencyDecayFunction: UrgencyDecayFunction = (timeDeltaHours, lambda) =>
  Math.exp(-lambda * Math.max(0, timeDeltaHours));

export const DEFAULT_TIME_ENGINE: SolenOSTimeEngine = {
  timezoneDetection: true,
  coarseLocationEnabled: false,
  strictTimeHorizonMode: false,
  timeHorizonModel: { ...DEFAULT_TIME_HORIZON_MODEL },
  urgencyDecayFunction: defaultUrgencyDecayFunction,
};

export const DEFAULT_TIME_INPUT_SIGNALS: TimeInputSignals = {
  missingTime: true,
};

export const DEFAULT_URGENCY_DECAY_LAMBDA = URGENCY_DECAY_LAMBDA;
