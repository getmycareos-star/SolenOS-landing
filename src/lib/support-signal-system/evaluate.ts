import {
  assessDeliveryEligibility,
  combineDeliveryChecks,
  isTimeOfDayPermitted,
} from "./delivery-rules";
import { mapSupportState } from "./map-support-state";
import { selectTemplateForState } from "./message-templates";
import { assessSuppression, assessUnclearValueSuppression } from "./suppression-rules";
import type { SupportSignalEvaluateInput, SupportSignalEvaluateResult } from "./types";

/**
 * Evaluate whether a support signal should be delivered.
 * Default: deliver=false (silence preferred).
 */
export function evaluateSupportSignal(
  input: SupportSignalEvaluateInput,
): SupportSignalEvaluateResult {
  const {
    last_delivered_at,
    previous_support_state,
    sustained_pressure_days = 0,
    now_ms,
    ...signal
  } = input;

  const support_state = mapSupportState(signal);

  const unclearSuppression = assessUnclearValueSuppression(signal.care_context_state);
  if (unclearSuppression.suppressed && support_state !== "crisis") {
    return {
      deliver: false,
      suppressed: true,
      support_state,
      reason: unclearSuppression.reason,
    };
  }

  const deliveryEligibility = assessDeliveryEligibility(
    signal,
    support_state,
    sustained_pressure_days,
  );
  if (!deliveryEligibility.eligible) {
    return {
      deliver: false,
      suppressed: false,
      support_state,
      reason: deliveryEligibility.reason,
    };
  }

  const timeCheck = isTimeOfDayPermitted(signal.time_of_day, support_state);
  const combined = combineDeliveryChecks(deliveryEligibility, timeCheck);
  if (!combined.eligible) {
    return {
      deliver: false,
      suppressed: false,
      support_state,
      reason: combined.reason,
    };
  }

  const suppression = assessSuppression(support_state, {
    last_delivered_at,
    previous_support_state,
    now_ms,
  });
  if (suppression.suppressed) {
    return {
      deliver: false,
      suppressed: true,
      support_state,
      reason: suppression.reason,
    };
  }

  const template = selectTemplateForState(
    support_state,
    now_ms ?? Date.now(),
  );
  if (!template) {
    return {
      deliver: false,
      suppressed: false,
      support_state,
      reason: "default silence: no static template for state",
    };
  }

  return {
    deliver: true,
    suppressed: false,
    support_state,
    template,
    reason: combined.reason,
  };
}
