import {
  TELEMETRY_ALLOWED_TABLES,
  TELEMETRY_FORBIDDEN_POSTGRES_USES,
  TELEMETRY_USER_FORBIDDEN_FIELDS,
} from "./contract-constants";

/** Forbidden SQL/application patterns — Postgres drift prevention. */
export const TELEMETRY_FORBIDDEN_CODE_PATTERNS = [
  "user_profiles",
  "care_journey",
  "patient_record",
  "behavioral_profile",
  "personalization",
  "session_state",
  "conversation_history",
  "user_memory",
  "longitudinal_profile",
  "caregiver_memory",
  "trust_score",
  "crm_",
  "onboarding",
  "dashboard",
] as const;

export const TELEMETRY_FORBIDDEN_IN_API = [
  "prisma",
  "drizzle",
  "sequelize",
  "typeorm",
  "care_journey",
  "user_profile",
  "personalization",
  "session_id",
  "conversation",
  "engagement_optimization",
  "retention_optimization",
  "user_scoring",
  "behavioral_prediction",
] as const;

export function isAllowedTelemetryTable(name: string): boolean {
  return TELEMETRY_ALLOWED_TABLES.includes(name as (typeof TELEMETRY_ALLOWED_TABLES)[number]);
}

export function detectUserSchemaDrift(columnName: string): boolean {
  return TELEMETRY_USER_FORBIDDEN_FIELDS.includes(columnName as never);
}

export { TELEMETRY_FORBIDDEN_POSTGRES_USES, TELEMETRY_ALLOWED_TABLES };
