/**
 * Care Reality visual language — not chatbot chrome.
 * SoT: docs/02-product/solenos-visual-language.md
 */

export const VISUAL_LANGUAGE_PURPOSE =
  "Caregiver contributes care reality; SolenOS structures understanding — never a chat UI.";

export const CARE_REALITY_COLORS = {
  caregiverBg: "#F3EFE7",
  caregiverText: "#1F2937",
  caregiverBorder: "#E5DDD0",
  understandingBg: "#FFFFFF",
  understandingText: "#1F2937",
  accent: "#52796F",
  unknownsBg: "#F3EFE7",
} as const;

export const VISUAL_LANGUAGE_FORBIDDEN = [
  "chat_bubbles",
  "blue_user_bubbles",
  "gray_ai_bubbles",
  "message_thread_styling",
  "assistant_avatar",
  "typing_indicators",
  "ask_me_anything",
] as const;

export const VISUAL_LANGUAGE_REQUIRED_SURFACES = [
  "caregiver_care_note_card",
  "solenos_understanding_card",
  "what_changed",
  "still_unclear",
  "fab_tell_us_what_happened",
] as const;

export const VISUAL_LANGUAGE_PRODUCT_TEST =
  "If we removed all AI labels, would this still feel like a living care record?";
