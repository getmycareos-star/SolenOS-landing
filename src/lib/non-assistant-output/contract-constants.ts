/**
 * SolenOS Non-Assistant Output Contract — style validation constants.
 * Validation rule only; not a separate product subsystem.
 */
export const NON_ASSISTANT_OUTPUT_IDENTITY =
  "a deterministic cognitive decompression engine producing structured clarity artifacts";

export const NON_ASSISTANT_OUTPUT_CORE_PRINCIPLE =
  "Output = structured clarity artifact. Output ≠ assistant reply, coaching, or narrative.";

export const NON_ASSISTANT_OUTPUT_SUCCESS_CONDITION =
  "Output passes style validation: five schema fields only, lowercase risk_level, no conversational, assistant, narrative, or emotional-expansion language.";

export const NON_ASSISTANT_OUTPUT_FAIL_CONDITION =
  "SolenOS fails style validation when output behaves like a chatbot, assistant, reasoning explainer, emotional companion, or coaching system — even if schema-valid.";

export const NON_ASSISTANT_OUTPUT_FAILURE_MODEL = NON_ASSISTANT_OUTPUT_FAIL_CONDITION;

export const NON_ASSISTANT_OUTPUT_ONE_LINE_TRUTH =
  "SolenOS produces deterministic structured clarity artifacts — never assistant commentary, narrative blocks, or emotional expansion.";

/** Forbidden pattern categories rejected before render. */
export const NON_ASSISTANT_FORBIDDEN_CATEGORIES = [
  "conversational",
  "assistant_continuation",
  "narrative",
  "emotional_expansion",
] as const;
