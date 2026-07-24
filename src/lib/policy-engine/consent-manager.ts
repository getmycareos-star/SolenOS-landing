import {
  DATA_IMPROVEMENT_CONSENT_STATEMENT,
  NO_ADVERTISING_CONSENT_STATEMENT,
  ONE_LINE_USER_AGREEMENT,
  TERMS_OF_SERVICE_VERSION,
} from "./contract-constants";
import {
  acceptConsent,
  getConsentProfile,
  hasValidConsent,
  revokeConsent,
  updateDataImprovementConsent,
} from "./consent-store";
import type { ConsentAcceptanceInput, ConsentProfile } from "./types";

export function getConsentManagerStatus(userId: string): {
  profile: ConsentProfile | null;
  verified: boolean;
  required: boolean;
  terms_version: string;
  one_line_agreement: string;
  data_improvement_statement: string;
  no_advertising_statement: string;
} {
  const profile = getConsentProfile(userId);
  const verified = hasValidConsent(userId);
  return {
    profile,
    verified,
    required: !verified,
    terms_version: TERMS_OF_SERVICE_VERSION,
    one_line_agreement: ONE_LINE_USER_AGREEMENT,
    data_improvement_statement: DATA_IMPROVEMENT_CONSENT_STATEMENT,
    no_advertising_statement: NO_ADVERTISING_CONSENT_STATEMENT,
  };
}

export function recordConsentAcceptance(input: ConsentAcceptanceInput): ConsentProfile {
  if (
    !input.medical_disclaimer_acknowledged ||
    !input.privacy_model_acknowledged ||
    !input.multi_caregiver_acknowledged ||
    !input.no_advertising_acknowledged
  ) {
    throw new Error("All mandatory consent acknowledgments are required.");
  }
  return acceptConsent({
    ...input,
    accepted_terms_version: input.accepted_terms_version || TERMS_OF_SERVICE_VERSION,
  });
}

export function seedVerifyConsent(userId: string): ConsentProfile {
  return recordConsentAcceptance({
    user_id: userId,
    accepted_terms_version: TERMS_OF_SERVICE_VERSION,
    medical_disclaimer_acknowledged: true,
    privacy_model_acknowledged: true,
    multi_caregiver_acknowledged: true,
    data_improvement_consent: false,
    no_advertising_acknowledged: true,
  });
}

export { revokeConsent, updateDataImprovementConsent, hasValidConsent, getConsentProfile };
