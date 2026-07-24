import { DOMAIN_TRIGGERS, signalPresent } from "./domain-triggers";
import type { CompletenessResult, CompletenessStatus } from "./types";

/**
 * Step 2 — Information completeness check against safety domain triggers.
 */
export function checkInformationCompleteness(input: string): CompletenessResult {
  const text = input.trim();
  const triggered = DOMAIN_TRIGGERS.filter((d) => d.triggerPattern.test(text));

  if (triggered.length === 0) {
    return {
      status: "COMPLETE",
      triggered_domains: [],
      present_signals: [],
      missing_signals: [],
    };
  }

  const present: string[] = [];
  const missing: string[] = [];
  const domains = triggered.map((d) => d.domain);

  for (const domain of triggered) {
    for (const signal of domain.requiredSignals) {
      if (signalPresent(text, signal)) {
        present.push(signal.label);
      } else {
        missing.push(signal.label);
      }
    }
  }

  const uniqueMissing = [...new Set(missing)];
  const uniquePresent = [...new Set(present)];

  let status: CompletenessStatus;
  if (uniqueMissing.length === 0) {
    status = "COMPLETE";
  } else if (uniquePresent.length === 0) {
    status = "INSUFFICIENT";
  } else if (uniqueMissing.length > uniquePresent.length) {
    status = "INSUFFICIENT";
  } else {
    status = "PARTIALLY_COMPLETE";
  }

  return {
    status,
    triggered_domains: domains,
    present_signals: uniquePresent,
    missing_signals: uniqueMissing,
  };
}
