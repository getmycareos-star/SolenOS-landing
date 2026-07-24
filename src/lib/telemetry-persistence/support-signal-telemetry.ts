import { z } from "zod";
import {
  MESSAGE_TEMPLATE_CATEGORIES,
  SUPPORT_SIGNAL_TELEMETRY_ALLOWED_FIELDS,
  SUPPORT_SIGNAL_TELEMETRY_FORBIDDEN_FIELDS,
} from "../support-signal-system/contract-constants";

export const SupportSignalTelemetryInsertSchema = z
  .object({
    user_id: z.string().uuid(),
    notification_id: z.string().min(1),
    category: z.enum(MESSAGE_TEMPLATE_CATEGORIES),
    delivered_at: z.string().datetime().nullable(),
    suppressed: z.boolean(),
  })
  .strict();

export type SupportSignalTelemetryInsert = z.infer<
  typeof SupportSignalTelemetryInsertSchema
>;

export function assertSupportSignalTelemetrySchemaBoundary(
  fields: readonly string[],
): void {
  const allowed = new Set<string>([
    "id",
    "user_id",
    ...SUPPORT_SIGNAL_TELEMETRY_ALLOWED_FIELDS,
  ]);
  for (const field of fields) {
    if (
      SUPPORT_SIGNAL_TELEMETRY_FORBIDDEN_FIELDS.includes(field as never)
    ) {
      throw new Error(`forbidden support signal telemetry field: ${field}`);
    }
    if (!allowed.has(field)) {
      throw new Error(
        `support signal telemetry schema drift — disallowed field: ${field}`,
      );
    }
  }
}

export const SupportSignalEvaluateRequestSchema = z
  .object({
    telemetry_user_id: z.string().uuid().optional(),
    care_context_state: z.enum([
      "active_care",
      "crisis",
      "post_care",
      "uncertain",
    ]),
    caregiver_depletion_state: z.enum(["normal", "elevated", "critical"]),
    is_single_caregiver: z.boolean(),
    recent_high_risk_event: z.boolean(),
    inactivity_days: z.number().min(0),
    time_of_day: z.enum(["morning", "afternoon", "night", "late_night"]),
    last_delivered_at: z.string().datetime().nullable().optional(),
    previous_support_state: z
      .enum(["crisis", "overload", "fatigue", "stable", "reentry"])
      .nullable()
      .optional(),
    sustained_pressure_days: z.number().min(0).optional(),
  })
  .strict();

export type SupportSignalEvaluateRequest = z.infer<
  typeof SupportSignalEvaluateRequestSchema
>;

/** API response — evaluation contract only; push delivery is out of scope for MVP. */
export const SupportSignalEvaluateResponseSchema = z
  .object({
    deliver: z.boolean(),
    suppressed: z.boolean(),
    support_state: z.enum([
      "crisis",
      "overload",
      "fatigue",
      "stable",
      "reentry",
    ]),
    template: z
      .object({
        id: z.string(),
        category: z.enum(MESSAGE_TEMPLATE_CATEGORIES),
        text: z.string(),
      })
      .optional(),
    reason: z.string(),
  })
  .strict();

export type SupportSignalEvaluateResponse = z.infer<
  typeof SupportSignalEvaluateResponseSchema
>;

export const SUPPORT_SIGNAL_TELEMETRY_RULE =
  "support_signal_events records delivery/suppression only — forbidden for engagement score, habit formation, retention optimization, or dependency tracking.";
