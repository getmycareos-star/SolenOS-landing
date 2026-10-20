import type {
  DecisionControl,
  EmotionalControl,
  LegacyMemoryControlsInput,
  MemoryControl,
  NotificationControl,
  PrivacyControl,
  SolenOSSettings,
  TimeControl,
  TransparencyControl,
} from "./types";

/** Default category weights when migrating legacy boolean memory toggles. */
export const LEGACY_MEMORY_WEIGHT_MAP = {
  identity: 0.25,
  patterns: 0.25,
  operational: 0.3,
  emotional: 0.2,
} as const;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function legacyMemoryToControl(legacy: LegacyMemoryControlsInput): MemoryControl {
  return {
    identityMemoryWeight: legacy.identityMemory ? LEGACY_MEMORY_WEIGHT_MAP.identity : 0,
    patternMemoryWeight: legacy.longTermPatternMemory ? LEGACY_MEMORY_WEIGHT_MAP.patterns : 0,
    operationalMemoryWeight: legacy.operationalMemory ? LEGACY_MEMORY_WEIGHT_MAP.operational : 0,
    emotionalMemoryWeight: legacy.emotionalMemory ? LEGACY_MEMORY_WEIGHT_MAP.emotional : 0,
    inferenceFromBehavior: legacy.inferenceFromBehavior ?? false,
    allowMemoryRead: true,
    allowMemoryWrite: true,
  };
}

function normalizeMemoryControl(input: unknown): MemoryControl | undefined {
  if (!isRecord(input)) return undefined;

  if (
    "identityMemoryWeight" in input ||
    "patternMemoryWeight" in input ||
    "operationalMemoryWeight" in input ||
    "emotionalMemoryWeight" in input
  ) {
    return input as MemoryControl;
  }

  if ("identityMemory" in input || "longTermPatternMemory" in input) {
    return legacyMemoryToControl(input as LegacyMemoryControlsInput);
  }

  return undefined;
}

function normalizeTimeControl(input: unknown): TimeControl | undefined {
  if (!isRecord(input)) return undefined;

  const strictTimeHorizonMode =
    "strictHorizonMode" in input
      ? Boolean(input.strictHorizonMode)
      : "strictTimeHorizonMode" in input
        ? Boolean(input.strictTimeHorizonMode)
        : undefined;

  if (
    "timezoneDetection" in input &&
    "coarseLocationEnabled" in input &&
    "timeHorizonModel" in input &&
    strictTimeHorizonMode !== undefined &&
    isRecord(input.timeHorizonModel)
  ) {
    return {
      timezoneDetection: Boolean(input.timezoneDetection),
      coarseLocationEnabled: Boolean(input.coarseLocationEnabled),
      strictTimeHorizonMode,
      timeHorizonModel: {
        NOW: String(input.timeHorizonModel.NOW),
        TODAY: String(input.timeHorizonModel.TODAY),
        SOON: String(input.timeHorizonModel.SOON),
        LATER: String(input.timeHorizonModel.LATER),
      },
    };
  }

  return undefined;
}

function normalizeNotificationControl(input: unknown): NotificationControl | undefined {
  if (!isRecord(input)) return undefined;

  const quietHoursEnabled =
    "quietHours" in input
      ? Boolean(input.quietHours)
      : "quietHoursEnabled" in input
        ? Boolean(input.quietHoursEnabled)
        : undefined;

  if (
    "urgencyFilter" in input &&
    "emergencyOverride" in input &&
    "digestMode" in input &&
    quietHoursEnabled !== undefined
  ) {
    return {
      urgencyFilter: input.urgencyFilter as NotificationControl["urgencyFilter"],
      quietHoursEnabled,
      emergencyOverride: Boolean(input.emergencyOverride),
      digestMode: input.digestMode as NotificationControl["digestMode"],
    };
  }

  return undefined;
}

function normalizePrivacyControl(input: unknown): PrivacyControl | undefined {
  if (!isRecord(input)) return undefined;

  const allowBehaviorInference =
    "allowBehaviorBasedInference" in input
      ? Boolean(input.allowBehaviorBasedInference)
      : "allowBehaviorInference" in input
        ? Boolean(input.allowBehaviorInference)
        : undefined;

  if (
    "exportEnabled" in input &&
    "deleteAccountEnabled" in input &&
    "disableInferenceEngine" in input &&
    "disableBehaviorSignals" in input &&
    allowBehaviorInference !== undefined
  ) {
    return {
      exportEnabled: Boolean(input.exportEnabled),
      deleteAccountEnabled: Boolean(input.deleteAccountEnabled),
      disableInferenceEngine: Boolean(input.disableInferenceEngine),
      disableBehaviorSignals: Boolean(input.disableBehaviorSignals),
      allowBehaviorInference,
    };
  }

  return undefined;
}

/**
 * Normalize partial settings input — accepts legacy field names and shapes.
 * Does not validate; use after merge with defaults and before schema parse.
 */
export function normalizeSettingsInput(input: unknown): Partial<SolenOSSettings> {
  if (!isRecord(input)) return {};

  const normalized: UnknownRecord = { ...input };

  const memorySource = input.memoryControl ?? input.memoryGovernance;
  const memoryControl = normalizeMemoryControl(memorySource);
  if (memoryControl) {
    normalized.memoryControl = memoryControl;
  }
  delete normalized.memoryGovernance;

  const timeSource = input.timeControl ?? input.timeEngine;
  const timeControl = normalizeTimeControl(timeSource);
  if (timeControl) {
    normalized.timeControl = timeControl;
  }
  delete normalized.timeEngine;

  if (input.emotionalControl) {
    normalized.emotionalControl = input.emotionalControl;
  } else if (input.emotionalModel) {
    normalized.emotionalControl = input.emotionalModel;
  }
  delete normalized.emotionalModel;

  if (input.transparencyControl) {
    normalized.transparencyControl = input.transparencyControl;
  } else if (input.aiTransparency) {
    normalized.transparencyControl = input.aiTransparency;
  }
  delete normalized.aiTransparency;

  const notificationControl = normalizeNotificationControl(input.notificationControl);
  if (notificationControl) {
    normalized.notificationControl = notificationControl;
  }

  const privacyControl = normalizePrivacyControl(input.privacyControl);
  if (privacyControl) {
    normalized.privacyControl = privacyControl;
  }

  if (input.decisionControl) {
    normalized.decisionControl = input.decisionControl as DecisionControl;
  }

  return normalized as Partial<SolenOSSettings>;
}

export function deriveMemoryVisibility(control: MemoryControl): import("./types-derived").MemoryVisibility {
  if (!control.allowMemoryRead) return "hidden";
  const total =
    control.identityMemoryWeight +
    control.patternMemoryWeight +
    control.operationalMemoryWeight +
    control.emotionalMemoryWeight;
  if (total <= 0) return "hidden";
  if (total > 0.85) return "full";
  return "summary";
}

export function memoryControlHasActiveWeights(control: MemoryControl): boolean {
  return (
    control.allowMemoryRead &&
    (control.identityMemoryWeight > 0 ||
      control.patternMemoryWeight > 0 ||
      control.operationalMemoryWeight > 0 ||
      control.emotionalMemoryWeight > 0)
  );
}
