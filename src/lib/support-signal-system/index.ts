export {
  SUPPORT_SIGNAL_PURPOSE,
  SUPPORT_SIGNAL_ONE_LINE_TRUTH,
  SUPPORT_SIGNAL_SUCCESS_DEFINITION,
  SUPPORT_SIGNAL_FORBIDDEN_USES,
  SUPPORT_SIGNAL_ANTI_DRIFT_RULES,
  SUPPORT_STATES,
  MESSAGE_TEMPLATE_CATEGORIES,
  TIME_OF_DAY_BUCKETS,
  REENTRY_INACTIVITY_DAYS_THRESHOLD,
  RECENT_NOTIFICATION_SUPPRESSION_HOURS,
  STABILIZATION_SUSTAINED_PRESSURE_DAYS,
  SUPPORT_SIGNAL_TELEMETRY_ALLOWED_FIELDS,
  SUPPORT_SIGNAL_TELEMETRY_FORBIDDEN_FIELDS,
} from "./contract-constants";
export type {
  SupportState,
  MessageTemplateCategory,
  TimeOfDay,
} from "./contract-constants";

export type {
  SupportSignal,
  MessageTemplate,
  DeliveryDecision,
  SupportSignalEvaluationContext,
  SupportSignalEvaluateInput,
  SupportSignalEvaluateResult,
  SupportSignalTelemetryEvent,
} from "./types";

export {
  MESSAGE_TEMPLATES,
  getTemplatesForCategory,
  selectTemplateForState,
  getTemplateById,
  OVERLOAD_SPEC_EXAMPLE_TEMPLATE_ID,
} from "./message-templates";

export {
  mapSupportState,
  isStabilizationCandidate,
  isReentryCandidate,
  hasCriticalOverload,
  hasCrisisSignal,
  hasFatigueSignal,
} from "./map-support-state";

export {
  assessDeliveryEligibility,
  isTimeOfDayPermitted,
  combineDeliveryChecks,
} from "./delivery-rules";
export type { DeliveryEligibility } from "./delivery-rules";

export {
  assessSuppression,
  assessUnclearValueSuppression,
} from "./suppression-rules";
export type { SuppressionResult } from "./suppression-rules";

export {
  classifyTimeOfDay,
  isLateNight,
  isMorning,
  isHighActivityWindow,
} from "./time-of-day";

export { evaluateSupportSignal } from "./evaluate";

/**
 * Engineering decision filter — support signals must never drive product behavior.
 */
export function assertSupportSignalObservationOnly(context: {
  usesForRouting?: boolean;
  usesForUiBranching?: boolean;
  usesForSchemaChange?: boolean;
  usesForLifecycle?: boolean;
  usesForStateMachine?: boolean;
  usesForProductMode?: boolean;
  usesForEngagement?: boolean;
  usesForRetention?: boolean;
}): void {
  const violations: string[] = [];
  if (context.usesForRouting) violations.push("lifecycle routing");
  if (context.usesForUiBranching) violations.push("UI branching");
  if (context.usesForSchemaChange) violations.push("output schema change");
  if (context.usesForLifecycle) violations.push("lifecycle routing");
  if (context.usesForStateMachine) violations.push("state machine");
  if (context.usesForProductMode) violations.push("product mode");
  if (context.usesForEngagement) violations.push("engagement optimization");
  if (context.usesForRetention) violations.push("retention optimization");
  if (violations.length > 0) {
    throw new Error(
      `support signal anti-drift violation — forbidden: ${violations.join(", ")}`,
    );
  }
}
