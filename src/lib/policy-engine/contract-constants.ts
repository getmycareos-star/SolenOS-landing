/** Policy Engine — runtime-enforced system rules, not static legal pages. */

export const POLICY_ENGINE_IDENTITY =
  "Policies are execution constraints that every engine must obey before producing or modifying care reality.";

export const POLICY_ENGINE_DEFINING_PRINCIPLE =
  "Capture always succeeds — PolicyEngine validates every write; consent gates interpretation and sharing, never raw CareEvent persistence.";

export const TERMS_OF_SERVICE_VERSION = "2026-07-15";

export const TERMS_EFFECTIVE_DATE = "15th July, 2026";

export const TERMS_CONTACT = "davidsolenos@gmail.com";

export const ONE_LINE_USER_AGREEMENT =
  "I understand SolenOS is an informational continuity system for caregiving and not a medical service, and I will not use it for clinical decision-making.";

export const DATA_IMPROVEMENT_CONSENT_STATEMENT =
  "SolenOS may use my de-identified care data to improve system intelligence, continuity modeling, and safety of care insights.";

export const NO_ADVERTISING_CONSENT_STATEMENT =
  "I understand my raw caregiver inputs are never sold or used for advertising.";

export const SIGNUP_IMPROVEMENT_COPY =
  "Help improve SolenOS. We may use de-identified care data to improve continuity and safety features. Your personal inputs are never sold or shared.";

export const MULTI_CAREGIVER_SHARING_PROMPT =
  "Do you consent to sharing this CareContext with additional caregivers?";

export const POLICY_RULES = [
  "medical_boundary",
  "privacy_partition",
  "no_raw_data_leakage",
  "uncertainty_required",
  "no_system_invention",
  "soft_consent_after_capture",
] as const;

/** Prohibited medical-advice language in outputs */
export const MEDICAL_BOUNDARY_PATTERNS = [
  /\b(you have|patient has|diagnosed with|diagnosis is)\b/i,
  /\b(prescribe|prescription should|take \d+ mg|increase dose to|decrease dose to)\b/i,
  /\b(treatment plan|recommended treatment|should treat with)\b/i,
  /\b(call 911 immediately|go to the er now|emergency:)\b/i,
  /\b(clinically proven|definitely has|confirmed diagnosis)\b/i,
] as const;

/** Allowed medical-boundary replacements */
export const MEDICAL_BOUNDARY_SAFE_ALTERNATIVES = {
  diagnosis: "observation reported — consult a licensed clinician",
  treatment: "information only — not treatment guidance",
  emergency: "urgent pattern noted — contact emergency services or a clinician directly",
} as const;

/** Attribution leakage patterns — must not appear in shared output */
export const ATTRIBUTION_LEAKAGE_PATTERNS = [
  /\bcaregiver\s+\w+\s+said\b/i,
  /\b(who said|who reported|who told)\b/i,
  /\btheir raw (?:note|input|message)\b/i,
  /\boriginal (?:phrasing|message) from\b/i,
  /\bsubmitted by caregiver\b/i,
] as const;

/** False certainty patterns */
export const FALSE_CERTAINTY_PATTERNS = [
  /\bdefinitely\b/i,
  /\bwithout doubt\b/i,
  /\bcertainly true\b/i,
  /\b100%\s+(?:sure|certain|confirmed)\b/i,
  /\bguaranteed to\b/i,
] as const;

/** Medical advice / clinical-instruction patterns in caregiver input.
 * Flag for output constraints only — NEVER refuse intake.
 * Worry, fear, and med-change questions must still enter the Living Care Record.
 */
export const MEDICAL_ADVICE_REQUEST_PATTERNS = [
  // Clinical instruction / prescribe requests (constrain answers — still capture).
  /\b(what should (?:i|we) (?:give|prescribe))\b/i,
  /\b(what should (?:i|we) do about (?:the )?(?:medication|meds|dose|drug|symptoms?|pain|blood pressure|diagnosis))\b/i,
  /\b(is this (?:serious|dangerous|fatal))\b/i,
  /\b(should (?:i|we) (?:stop|start|change) (?:the )?med(?:ication|s)?)\b/i,
  /\bwhat (?:medication|drug|dose) (?:should|to give)\b/i,
] as const;

/** Capture always — consent soft-prompts after persist; medical concern never blocks intake. */
export const POLICY_CAPTURE_ALWAYS_PRINCIPLE =
  "Always persist raw input as CareEvents; gate interpretation and sharing; soft-prompt consent after capture; never refuse intake for overwhelm or medical concern.";

/** Soft prompt shown after capture when terms are not yet accepted. */
export const POLICY_SOFT_CONSENT_AFTER_CAPTURE =
  "What you shared is preserved in the care record. When you're ready, accept the privacy terms so SolenOS can use this record more fully.";


export const POLICY_COMPONENTS = [
  "ConsentManager",
  "DataUseRules",
  "PrivacyPartitionRules",
  "MedicalBoundaryRules",
  "AIOutputConstraints",
  "AuditComplianceLogger",
] as const;
