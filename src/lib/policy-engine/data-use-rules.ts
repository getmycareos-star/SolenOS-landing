import { getConsentProfile } from "./consent-store";
import type { DataUsePolicyResult } from "./types";

export function evaluateDataUseRules(userId: string): DataUsePolicyResult {
  const profile = getConsentProfile(userId);

  if (!profile || profile.limited_mode) {
    return {
      improvement_allowed: false,
      strict_privacy_mode: true,
      aggregation_allowed: false,
      reason: "Consent not verified or limited mode active — no improvement pipelines.",
    };
  }

  if (!profile.data_improvement_consent) {
    return {
      improvement_allowed: false,
      strict_privacy_mode: true,
      aggregation_allowed: false,
      reason: "Data improvement consent not given — functional storage only.",
    };
  }

  return {
    improvement_allowed: true,
    strict_privacy_mode: false,
    aggregation_allowed: true,
    reason: "De-identified CareEvent structures may be used for system improvement.",
  };
}
