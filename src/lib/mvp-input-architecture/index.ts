/**
 * MVP Input Architecture — text + documents only.
 * Voice enters the same pipeline later; not an MVP product surface.
 * ADR: docs/15-architecture-decisions/ADR-018-mvp-input-text-documents-only.md
 */

export const MVP_INPUT_ARCHITECTURE_IDENTITY =
  "SolenOS MVP accepts messy text and documents — not voice.";

export const MVP_INPUT_CHANNELS = ["text", "document"] as const;
export type MvpInputChannel = (typeof MVP_INPUT_CHANNELS)[number];

/** Future channel — same User Input → Understanding → Care Record path. */
export const FUTURE_INPUT_CHANNELS = ["voice"] as const;

export const MVP_INPUT_PRINCIPLES = [
  "accept_messy_incomplete_unstructured_input",
  "first_input_content_unknown_messiness_predictable",
  "no_perfect_structure_required_before_value",
  "documents_and_text_only_in_mvp_ui",
  "voice_is_future_input_not_mvp",
  "pipeline_stays_generic_for_future_channels",
] as const;

export const MVP_INPUT_FLOW = [
  "document_or_text",
  "processing_layer",
  "understanding_extraction",
  "care_actions_and_timeline",
] as const;

export const MVP_INPUT_FORBIDDEN_SURFACES = [
  "voice_input_mic",
  "speech_recognition_ui",
  "voice_conversation_mode",
  "text_to_speech_hear_solenos",
  "whisper_or_voice_api_product_path",
] as const;

export const MVP_INPUT_PROOF_QUESTION =
  "Can SolenOS turn scattered caregiver information into understandable next steps?";

export function isMvpInputChannel(channel: string): channel is MvpInputChannel {
  return (MVP_INPUT_CHANNELS as readonly string[]).includes(channel);
}

/** True when a UI/feature description is a forbidden MVP voice surface. */
export function isForbiddenMvpVoiceSurface(description: string): boolean {
  const lower = description.toLowerCase();
  return [
    /\bmic(rophone)?\b/,
    /\bvoice input\b/,
    /\bspeech recognition\b/,
    /\bvoice conversation\b/,
    /\btext[- ]to[- ]speech\b/,
    /\bhear solenos\b/,
    /\bread aloud\b/,
    /\bwhisper\b/,
    /\btts\b/,
  ].some((p) => p.test(lower));
}

export {
  CAREGIVER_FORBIDDEN_UI_TERMS,
  classifyInputMessiness,
  dedupeCaregiverFacingLines,
  FIRST_INPUT_INVARIANTS,
  humanizeUncertaintyForCaregiver,
  INPUT_MESSINESS_LEVELS,
  isBareSchemaField,
  isCaregiverSafeDisplayText,
  isGenericSignalText,
  isImmediateDangerLanguage,
  isRetrospectiveCareReport,
  resolveCaregiverWords,
  sanitizeCaregiverDisplayText,
  sanitizeCaregiverErrorMessage,
  toCaregiverFacingLine,
} from "./first-input";
export type { InputMessinessLevel } from "./first-input";
