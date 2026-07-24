/** Trust, Disclaimer & Footer Execution Layer — post-reasoning output assembly only. */

export const TRUST_LAYER_IDENTITY =
  "a deterministic post-reasoning output assembly layer that attaches domain safety disclaimers and audit footers without influencing reasoning";

export const TRUST_LAYER_ONE_LINE_TRUTH =
  "Safety annotations describe boundaries and uncertainty — they never modify reasoning, decisions, or facts.";

export const TRUST_LAYER_PIPELINE_POSITION =
  "OUTPUT ASSEMBLY LAYER — after reasoning and validation, before final response";

export const TRUST_LAYER_FORBIDDEN = [
  "influence reasoning",
  "change decisions",
  "add facts",
  "infer intent",
  "modify SolenOS response fields",
] as const;

export const FOOTER_STRICT_ORDER = [
  "DOCUMENT_SAFETY",
  "MEDICAL_SAFETY",
  "INSURANCE_BENEFITS",
  "SYSTEM_LIMIT",
  "ASSUMPTIONS",
  "CONFIDENCE",
  "UNCERTAINTY",
] as const;

export const REQUIRED_FOOTER_KINDS = [
  "SYSTEM_LIMIT",
  "ASSUMPTIONS",
  "CONFIDENCE",
  "UNCERTAINTY",
] as const;

export const DOMAIN_DISCLAIMER_TEXT = {
  MEDICAL:
    "Not medical advice, diagnosis, or treatment guidance. Consult qualified healthcare professionals for clinical decisions.",
  INSURANCE:
    "Not insurance advice or a coverage determination. Verify details with your insurer or plan administrator.",
  BENEFITS:
    "Not a benefits eligibility determination. Confirm program rules and eligibility with the administering agency.",
  DOCUMENT:
    "Uploaded or scanned documents may be incomplete or misread. Verify critical facts against original records.",
} as const;

export const FOOTER_TEXT = {
  SYSTEM_LIMIT:
    "SolenOS compresses uncertainty into structured next steps — it does not replace professional judgment, agency decisions, or original records.",
  ASSUMPTIONS_EMPTY: "No explicit assumptions recorded beyond what you stated.",
  CONFIDENCE: {
    low: "Confidence: moderate — limited input detail; treat prioritization as provisional.",
    medium: "Confidence: moderate — some gaps remain; verify key facts before acting.",
    high: "Confidence: focused — urgency signals present; still confirm with appropriate professionals.",
    critical: "Confidence: high urgency framing only — not a clinical or legal determination.",
  },
  UNCERTAINTY:
    "Uncertainty remains by design. What is unknown is not resolved here — use the next questions to close gaps.",
} as const;
