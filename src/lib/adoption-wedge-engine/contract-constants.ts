/** Adoption Wedge — zero-onboarding, ingestion-first entry: send everything, get structured truth. */

export const ADOPTION_WEDGE_IDENTITY =
  "Send me everything. I'll organize it.";

export const ADOPTION_WEDGE_DEFINING_PRINCIPLE =
  "First action = first value. No signup, no setup, no structure required.";

export const ACCEPTED_INPUT_TYPES = [
  "whatsapp_forward",
  "voice_note",
  "pdf_discharge",
  "medical_image",
  "plain_text",
  "screenshot",
] as const;

export const ADOPTION_WEDGE_SECTIONS = [
  "structured_summary_of_chaos",
  "current_state_snapshot",
  "actionable_output",
] as const;

export const ADOPTION_WEDGE_RULES = [
  "zero_onboarding",
  "first_action_first_value",
  "clarity_from_chaos",
  "no_chat_filler",
  "no_setup_wizard",
] as const;

export const INGESTION_READY_MESSAGE =
  "Forward any care-related content — WhatsApp messages, voice notes, PDFs, images, or plain text.";

export const ORGANIZED_LEAD_MESSAGE = "I've organized what you sent.";
