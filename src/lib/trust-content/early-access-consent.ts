/**
 * Early-access / signup consent gate — awareness, not bureaucracy.
 * Submit requires Terms + Privacy acknowledgment only.
 */

export type EarlyAccessConsentState = {
  termsAccepted: boolean;
  privacyAccepted: boolean;
};

export function canSubmitEarlyAccessConsent(
  state: EarlyAccessConsentState,
): boolean {
  return state.termsAccepted === true && state.privacyAccepted === true;
}

/** Public routes that must exist for trust/legal visibility. */
export const TRUST_LEGAL_PUBLIC_ROUTES = [
  "/privacy",
  "/terms",
  "/contact",
  "/support",
  "/about",
  "/early-access",
] as const;

export const EARLY_ACCESS_CONSENT_PURPOSE =
  "User awareness and consent without a blocking legal wall.";
