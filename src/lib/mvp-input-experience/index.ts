/**
 * MVP Input Experience — hand SolenOS the care situation; no software homework.
 * SoT: docs/02-product/solenos-mvp-input-experience.md
 */

import { MVP_COMPOSER_ENTRY_ACTIONS } from "../input-entry-contract";

export const MVP_INPUT_EXPERIENCE_PURPOSE =
  "First interaction feels like handing over the care situation — not using software.";

/** Primary entry actions — not separate products. */
export const MVP_INPUT_PRIMARY_ACTIONS = MVP_COMPOSER_ENTRY_ACTIONS;

/** Starting feel — illustration only; composer may paraphrase. */
export const MVP_INPUT_STARTING_QUESTION_FEEL =
  "What is happening with the person you care for?";

/** Auth before value is forbidden at MVP entry. */
export const MVP_INPUT_AUTH_POLICY = {
  require_signup_before_capture: false,
  require_login_before_capture: false,
  require_profile_form_before_capture: false,
  anonymous_care_workspace_allowed: true,
  auth_trigger:
    "The care memory has become valuable enough that losing it matters.",
} as const;

/** Success metric — not upload/account counts. */
export const MVP_INPUT_SUCCESS_METRIC =
  "After adding information, the caregiver understands the situation better.";

/** Forbidden MVP entry friction. */
export const MVP_INPUT_FORBIDDEN_BEFORE_VALUE = [
  "create an account",
  "complete a profile",
  "long onboarding questionnaire",
  "organize files before upload",
] as const;

export function assertMvpInputAuthAllowsAnonymousCapture(): void {
  if (MVP_INPUT_AUTH_POLICY.require_signup_before_capture) {
    throw new Error("MVP input experience: signup must not gate capture");
  }
  if (MVP_INPUT_AUTH_POLICY.require_login_before_capture) {
    throw new Error("MVP input experience: login must not gate capture");
  }
  if (MVP_INPUT_AUTH_POLICY.require_profile_form_before_capture) {
    throw new Error("MVP input experience: profile form must not gate capture");
  }
  if (!MVP_INPUT_AUTH_POLICY.anonymous_care_workspace_allowed) {
    throw new Error("MVP input experience: anonymous care workspace required");
  }
}
