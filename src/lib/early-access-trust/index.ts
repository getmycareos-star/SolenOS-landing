/**
 * Early-access / research-preview trust copy + consent (local).
 * SoT: docs/02-product/solenos-trust-consent-flow.md · learning-first release
 * Visible, accessible — never a legal wall before care value.
 */

export const SUPPORT_EMAIL = "davidsolenos@gmail.com";

export const EARLY_ACCESS_BADGE = "Early Access";

export const RESEARCH_PREVIEW_CONSENT_KEY = "solenos_research_preview_ack_v1";

export const RESEARCH_PREVIEW_SECTION = {
  title: "SolenOS Research Preview",
  lead:
    "You are using an early version of SolenOS designed to understand how technology can better support family caregivers.",
  complexity:
    "Caregiving situations are complex. Every person's care journey is different, and understanding someone's situation requires context, history, and human judgment.",
  mayNotice: [
    "incomplete features",
    "imperfect wording",
    "situations where SolenOS does not fully understand the context yet",
    "responses that may need correction or additional information",
    "areas where the experience is still being improved",
  ],
  feedback:
    "SolenOS is learning from real caregiving situations. Your feedback helps improve how SolenOS organizes information, identifies changes, and understands what matters in a person's care journey.",
  ackLabel: "I understand this is an early version.",
} as const;

export const FREE_EARLY_ACCESS_SECTION = {
  title: "Free Early Access",
  body: [
    "You are currently using SolenOS during our early access period at no cost.",
    "This allows caregivers to explore SolenOS and help us improve how it understands real caregiving situations.",
    "As SolenOS develops, access and pricing may change in the future.",
    "Early users help shape what SolenOS becomes.",
  ],
} as const;

export const WHY_SOLENOS_EXISTS_SHORT = {
  title: "Why SolenOS Exists",
  body: [
    "Caregiving often involves scattered information, changing situations, and difficult decisions.",
    "Important details can get lost between conversations, documents, appointments, and everyday responsibilities.",
    "SolenOS is being built to help caregivers organize the care story over time — what happened, what changed, what is known, and what still needs attention.",
  ],
} as const;

export const WHAT_SOLENOS_DOES = {
  title: "What SolenOS does",
  items: [
    "organize care information",
    "connect notes, documents, observations, and updates",
    "identify important events",
    "understand changes over time",
    "see what information is known",
    "identify what information is missing",
  ],
} as const;

export const WHAT_SOLENOS_DOES_NOT = {
  title: "What SolenOS does not do",
  items: [
    "diagnose medical conditions",
    "replace healthcare professionals",
    "make medical decisions",
    "provide emergency guidance",
    "guarantee every interpretation is correct",
  ],
  closing:
    "SolenOS supports understanding and organization. It does not replace professional healthcare.",
} as const;

export const YOUR_INFORMATION_SECTION = {
  title: "Your Information",
  body: [
    "SolenOS uses the information you provide to help organize and understand the care situation.",
    "Your information is used to create your personal Care Record.",
    "We encourage you to only upload information you are comfortable storing in SolenOS.",
    "You remain responsible for reviewing information and deciding what actions to take.",
  ],
} as const;

export const HOW_TO_USE_SECTION = {
  title: "How To Use SolenOS",
  lead: "You do not need to write perfectly. You can share a simple observation, a question, a document, a message, or a care update.",
  examples: [
    "Mom has been sleeping more this week.",
    "Dad came home from hospital yesterday.",
    "The doctor changed this medication.",
    "I am worried something has changed.",
  ],
  closing: "SolenOS works best when information is added over time.",
} as const;

export const QUESTIONS_EXPECTATION_SECTION = {
  title: "Understanding Takes Context",
  body: [
    "Care situations change over time.",
    "Sometimes SolenOS may ask questions because important context is missing.",
    "Questions help identify what changed, when it changed, and what information is still unclear.",
  ],
} as const;

export const MEDICAL_DISCLAIMER_SHORT =
  "SolenOS helps organize information and support caregiver understanding. It is not a replacement for medical professionals, healthcare advice, or emergency services.";

export const EMERGENCY_BOUNDARY =
  "If you believe there is an emergency or immediate safety concern, contact appropriate emergency services or healthcare professionals.";

export const UPLOAD_PRIVACY_NOTICE =
  "Your uploads may contain sensitive care information. Please only upload information you are comfortable storing in SolenOS.";

export const IN_APP_IMPROVING_NOTICE =
  "SolenOS is continuously improving how it understands real caregiving situations. If something seems incorrect or important context is missing, your feedback helps improve the system.";

export const EARLY_USER_STATUS = {
  title: "Early Access User",
  body: "You are among the first caregivers helping shape SolenOS. Your feedback helps us understand what caregivers need most, where SolenOS misunderstands, and how the Care Reality Engine should improve.",
} as const;

export const CONTINUING_AGREEMENT =
  "By continuing to use SolenOS, you agree to our Terms of Service and Privacy Policy.";

export const FEEDBACK_INVITE =
  "Your feedback is one of the most important parts of improving SolenOS. If something feels unclear, incorrect, or missing, please tell us.";

export const UNDERSTANDING_FEEDBACK_QUESTION =
  "Did SolenOS understand this situation clearly?";

export const UNDERSTANDING_MISUNDERSTAND_OPTIONS = [
  "Missing important information",
  "Incorrect understanding",
  "Wrong priority",
  "Confusing explanation",
  "Other",
] as const;

export function hasResearchPreviewAck(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(RESEARCH_PREVIEW_CONSENT_KEY) === "1";
  } catch {
    return false;
  }
}

export function markResearchPreviewAck(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      RESEARCH_PREVIEW_CONSENT_KEY,
      "1",
    );
    window.localStorage.setItem(
      `${RESEARCH_PREVIEW_CONSENT_KEY}_at`,
      new Date().toISOString(),
    );
  } catch {
    /* ignore */
  }
}
