import { z } from "zod";
import {
  CARE_GRAPH_ROLES,
  CARE_PROFILE_UPDATE_MODES,
  TIME_SENSITIVITIES,
  WORKLOAD_INTENSITIES,
} from "./contract-constants";
import type { CareProfileConflictField } from "./types";

const CONFLICT_FIELDS = [
  "roleInCareGraph",
  "careRelationships",
  "conditionSignals",
  "workloadIntensity",
  "timeSensitivity",
  "careRelationships.dependents",
] as const satisfies readonly CareProfileConflictField[];

export const CareProfileSchema = z
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

export const CareProfileVersionSchema = z
  .object({
    version: z.number().int().positive(),
    profile: CareProfileSchema,
    updatedAt: z.string(),
    updateMode: z.enum(CARE_PROFILE_UPDATE_MODES),
    confidence: z.number().min(0).max(1),
    reason: z.string(),
  })
  .strict();

export const CareProfileStateSchema = z
  .object({
    userId: z.string(),
    currentVersion: z.number().int().positive(),
    profile: CareProfileSchema,
    history: z.array(CareProfileVersionSchema),
    pendingConflicts: z.array(
      z
        .object({
          field: z.enum(CONFLICT_FIELDS),
          storedValue: z.unknown(),
          inferredValue: z.unknown(),
          detectedAt: z.string(),
          resolved: z.boolean(),
        })
        .strict(),
    ),
    inferenceSignalCounts: z.record(z.string(), z.number()),
  })
  .strict();

export function parseCareProfile(value: unknown) {
  return CareProfileSchema.parse(value);
}

export function parseCareProfileState(value: unknown) {
  return CareProfileStateSchema.parse(value);
}
