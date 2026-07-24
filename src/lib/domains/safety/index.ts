/**
 * Safety domain — urgency detection, CRITICAL escalation.
 * Owns LOW/MEDIUM/HIGH/CRITICAL classification only.
 */

export const SAFETY_DOMAIN_PURPOSE =
  "Urgency-aware prioritization with CRITICAL escalation — no notification delivery or storage.";

export * from "../../urgency-detection";
export * from "../../safety-override";
