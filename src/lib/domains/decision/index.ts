/**
 * Decision domain — SolenOS cognitive decompression output generation.
 * 5-field structured output. NO storage, auth, or notifications.
 */

export const DECISION_DOMAIN_PURPOSE =
  "Deterministic cognitive decompression — structured clarity under uncertainty.";

export const DECISION_FORBIDDEN = [
  "storage writes",
  "auth",
  "notification generation",
  "case CRUD",
  "memory persistence",
] as const;

export * from "../../analyze-pipeline";
