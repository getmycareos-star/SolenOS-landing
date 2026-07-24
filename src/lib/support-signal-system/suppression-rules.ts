import { RECENT_NOTIFICATION_SUPPRESSION_HOURS } from "./contract-constants";
import type { CareContextState } from "../post-care-insight/contract-constants";
import type { SupportSignalEvaluationContext, SupportState } from "./types";

export type SuppressionResult = {
  suppressed: boolean;
  reason: string;
};

function hoursSince(isoTimestamp: string, nowMs: number): number {
  const then = Date.parse(isoTimestamp);
  if (Number.isNaN(then)) return Infinity;
  return (nowMs - then) / (1000 * 60 * 60);
}

/**
 * Suppression rules:
 * - recent notification sent
 * - no state change since last delivery
 * - unclear value → do NOT send
 * When uncertain, do not send.
 */
export function assessSuppression(
  supportState: SupportState,
  context: Pick<
    SupportSignalEvaluationContext,
    "last_delivered_at" | "previous_support_state" | "now_ms"
  >,
): SuppressionResult {
  const nowMs = context.now_ms ?? Date.now();

  if (context.last_delivered_at) {
    const hours = hoursSince(context.last_delivered_at, nowMs);
    if (hours < RECENT_NOTIFICATION_SUPPRESSION_HOURS) {
      return {
        suppressed: true,
        reason: `suppressed: recent notification within ${RECENT_NOTIFICATION_SUPPRESSION_HOURS}h`,
      };
    }
  }

  if (
    context.previous_support_state !== undefined &&
    context.previous_support_state !== null &&
    context.previous_support_state === supportState
  ) {
    return {
      suppressed: true,
      reason: "suppressed: no support state change since last evaluation",
    };
  }

  return { suppressed: false, reason: "not suppressed" };
}

export function assessUnclearValueSuppression(
  careContextState: CareContextState,
): SuppressionResult {
  if (careContextState === "uncertain") {
    return {
      suppressed: true,
      reason: "suppressed: unclear value — care context uncertain",
    };
  }
  return { suppressed: false, reason: "not suppressed" };
}
