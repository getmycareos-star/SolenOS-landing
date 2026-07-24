/**
 * Non-Conversational Cognitive Transformation Engine — contract constants.
 */
export const NON_CONVERSATIONAL_IDENTITY =
  "a deterministic cognitive transformation engine that converts caregiver input into structured clarity blocks under uncertainty";

export const NON_CONVERSATIONAL_CORE_PRINCIPLE =
  "Structure ≠ conversation. Structure = cognitive clarity under uncertainty.";

export const NON_CONVERSATIONAL_FAILURE_MODEL =
  "SolenOS fails when it behaves like a chatbot, introduces conversational tone, varies structure across runs, or simulates dialogue — even if output quality improves.";

export const NON_CONVERSATIONAL_ONE_LINE_TRUTH =
  "SolenOS is a deterministic, non-conversational cognitive transformation engine that converts caregiver input into structured clarity blocks without dialogue, without inference, and without variation.";

export const NON_CONVERSATIONAL_OUTPUT_ROLE =
  "INPUT → STRUCTURED COGNITIVE MAP → OUTPUT";

export const NON_CONVERSATIONAL_CLARIFICATION_ROLE =
  "what_to_ask_next is a structured dependency resolution layer — NOT dialogue, NOT interaction, NOT conversation.";

/** Core clarity blocks (caregiver-facing transformation unit). */
export const NON_CONVERSATIONAL_CORE_BLOCKS = [
  "what_is_happening",
  "what_matters_now",
  "what_to_ask_next",
  "risk_level",
  "what_can_wait",
  "follow_up_items",
] as const;
