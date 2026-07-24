import { z } from "zod";

import { DEFAULT_SOLENOS_SETTINGS } from "./defaults";

import { normalizeSettingsInput } from "./normalize-settings";

import {

  CARE_GRAPH_ROLES,

  DECISION_AUTHORITY_LEVELS,

  EMERGENCY_SENSITIVITIES,

  SAFETY_RISK_TOLERANCE_LEVELS,

  EMOTIONAL_MODES,

  MEDICAL_MODES,

  NOTIFICATION_DIGEST_MODES,

  NOTIFICATION_URGENCY_FILTERS,

  REASONING_VISIBILITY_LEVELS,

  SYSTEM_MODES,

  TIME_SENSITIVITIES,

  WORKLOAD_INTENSITIES,

} from "./contract-constants";



export const CareContextProfileSchema = z

  .object({

    roleInCareGraph: z.enum(CARE_GRAPH_ROLES),

    careRelationships: z.object({

      dependents: z.array(z.string()),

      sharedCareWith: z.array(z.string()),

      externalCaregivers: z.array(z.string()),

    }),

    conditionSignals: z.object({

      medicationReminders: z.boolean(),

      mobilityAssistance: z.boolean(),

    }),

    workloadIntensity: z.enum(WORKLOAD_INTENSITIES),

    timeSensitivity: z.enum(TIME_SENSITIVITIES),

  })

  .strict();



export const MemoryControlSchema = z

  .object({

    identityMemoryWeight: z.number().min(0).max(1),

    patternMemoryWeight: z.number().min(0).max(1),

    operationalMemoryWeight: z.number().min(0).max(1),

    emotionalMemoryWeight: z.number().min(0).max(1),

    inferenceFromBehavior: z.boolean(),

    allowMemoryWrite: z.boolean(),

    allowMemoryRead: z.boolean(),

  })

  .strict();



/** @deprecated Use MemoryControlSchema */

export const MemoryControlsSchema = MemoryControlSchema;



export const DecisionControlSchema = z

  .object({

    level: z.enum(DECISION_AUTHORITY_LEVELS),

    requireConfirmationForHighRisk: z.boolean(),

    showAlternatives: z.boolean(),

    reasoningVisibility: z.enum(REASONING_VISIBILITY_LEVELS),

    manualOverrideEnabled: z.boolean(),

  })

  .strict();



/** @deprecated Use DecisionControlSchema */

export const DecisionAuthoritySchema = DecisionControlSchema;



export const TimeControlSchema = z

  .object({

    timezoneDetection: z.boolean(),

    coarseLocationEnabled: z.boolean(),

    timeHorizonModel: z.object({

      NOW: z.string(),

      TODAY: z.string(),

      SOON: z.string(),

      LATER: z.string(),

    }),

    strictTimeHorizonMode: z.boolean(),

  })

  .strict();



/** @deprecated Use TimeControlSchema */

export const TimeControlsSchema = TimeControlSchema;



export const EmotionalControlSchema = z

  .object({

    emotionalLoadDetection: z.boolean(),

    burnoutDetection: z.boolean(),

    griefSensitivity: z.boolean(),

    overloadSimplification: z.boolean(),

    mode: z.enum(EMOTIONAL_MODES),

  })

  .strict();



/** @deprecated Use EmotionalControlSchema */

export const EmotionalControlsSchema = EmotionalControlSchema;



export const NotificationControlSchema = z

  .object({

    urgencyFilter: z.enum(NOTIFICATION_URGENCY_FILTERS),

    quietHoursEnabled: z.boolean(),

    emergencyOverride: z.boolean(),

    digestMode: z.enum(NOTIFICATION_DIGEST_MODES),

  })

  .strict();



/** @deprecated Use NotificationControlSchema */

export const NotificationControlsSchema = NotificationControlSchema;



export const PrivacyControlSchema = z

  .object({

    exportEnabled: z.boolean(),

    deleteAccountEnabled: z.boolean(),

    disableInferenceEngine: z.boolean(),

    disableBehaviorSignals: z.boolean(),

    allowBehaviorInference: z.boolean(),

  })

  .strict();



/** @deprecated Use PrivacyControlSchema */

export const PrivacyControlsSchema = PrivacyControlSchema;



export const TransparencyControlSchema = z

  .object({

    reasoningVisibility: z.enum(REASONING_VISIBILITY_LEVELS),

    uncertaintyDisplay: z.boolean(),

    confidenceDisplay: z.boolean(),

    showAlternatives: z.boolean(),

  })

  .strict();



/** @deprecated Use TransparencyControlSchema */

export const TransparencyControlsSchema = TransparencyControlSchema;



export const SafetyControlSchema = z

  .object({

    medicalMode: z.enum(MEDICAL_MODES),

    emergencySensitivity: z.enum(EMERGENCY_SENSITIVITIES),

    externalEscalationEnabled: z.boolean(),

    alwaysShowUncertainty: z.boolean(),

    noCertaintyMode: z.boolean(),

    riskTolerance: z.enum(SAFETY_RISK_TOLERANCE_LEVELS),

  })

  .strict();



/** @deprecated Use SafetyControlSchema */

export const SafetyControlsSchema = SafetyControlSchema;



export const SolenOSSettingsSchema = z

  .object({

    careContext: CareContextProfileSchema,

    memoryControl: MemoryControlSchema,

    decisionControl: DecisionControlSchema,

    timeControl: TimeControlSchema,

    emotionalControl: EmotionalControlSchema,

    notificationControl: NotificationControlSchema,

    privacyControl: PrivacyControlSchema,

    transparencyControl: TransparencyControlSchema,

    safetyControl: SafetyControlSchema,

    systemMode: z.enum(SYSTEM_MODES),

  })

  .strict();



export type ParsedSolenOSSettings = z.infer<typeof SolenOSSettingsSchema>;



export function parseSolenOSSettings(input: unknown): ParsedSolenOSSettings {

  const normalized = normalizeSettingsInput(input);

  const merged = deepMerge(DEFAULT_SOLENOS_SETTINGS, normalized);

  return SolenOSSettingsSchema.parse(merged);

}



export function mergeWithDefaultSettings(

  partial: Partial<ParsedSolenOSSettings> | undefined,

): ParsedSolenOSSettings {

  if (!partial) {

    return SolenOSSettingsSchema.parse(structuredClone(DEFAULT_SOLENOS_SETTINGS));

  }

  const normalized = normalizeSettingsInput(partial);

  return SolenOSSettingsSchema.parse(deepMerge(DEFAULT_SOLENOS_SETTINGS, normalized));

}



function deepMerge<T extends Record<string, unknown>>(base: T, override: Partial<T>): T {

  const result = { ...base };

  for (const key of Object.keys(override) as (keyof T)[]) {

    const overrideVal = override[key];

    const baseVal = base[key];

    if (

      overrideVal &&

      typeof overrideVal === "object" &&

      !Array.isArray(overrideVal) &&

      baseVal &&

      typeof baseVal === "object" &&

      !Array.isArray(baseVal)

    ) {

      result[key] = deepMerge(

        baseVal as Record<string, unknown>,

        overrideVal as Record<string, unknown>,

      ) as T[keyof T];

    } else if (overrideVal !== undefined) {

      result[key] = overrideVal as T[keyof T];

    }

  }

  return result;

}


