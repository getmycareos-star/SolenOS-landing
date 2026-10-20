import { z } from "zod";

/**
 * Append-only domain events — never mutate or delete historical records.
 */
export const SYSTEM_EVENT_TYPES = [
  "document_uploaded",
  "document_processed",
  "interaction_created",
  "risk_detected",
  "decision_generated",
  "case_updated",
  "notification_sent",
] as const;

export type SystemEventType = (typeof SYSTEM_EVENT_TYPES)[number];

export const SystemEventTypeSchema = z.enum(SYSTEM_EVENT_TYPES);

export const SystemEventRecordSchema = z.object({
  id: z.string().uuid(),
  case_id: z.string().uuid().nullable(),
  user_id: z.string().uuid(),
  event_type: SystemEventTypeSchema,
  payload: z.record(z.string(), z.unknown()),
  created_at: z.string().datetime(),
});

export type SystemEventRecord = z.infer<typeof SystemEventRecordSchema>;

export const SystemEventInsertSchema = z.object({
  case_id: z.string().uuid().nullable().optional(),
  user_id: z.string().uuid(),
  event_type: SystemEventTypeSchema,
  payload: z.record(z.string(), z.unknown()).default({}),
});

export type SystemEventInsert = z.infer<typeof SystemEventInsertSchema>;
