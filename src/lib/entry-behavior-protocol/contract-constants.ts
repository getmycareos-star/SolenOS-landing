/** Entry Behavior + State Reconciliation Protocol — greetings are state requests, not chat. */

export const ENTRY_BEHAVIOR_IDENTITY =
  "SolenOS does not respond to greetings. It responds to system state requests.";

export const ENTRY_BEHAVIOR_DEFINING_PRINCIPLE =
  "Any input without a CareEvent is treated as re-enter session → reconstruct and display current care reality.";

export const ENTRY_INPUT_KINDS = [
  "SESSION_REENTRY_EVENT",
  "CARE_EVENT",
] as const;

export const ENTRY_MODES = ["session_reentry", "initialization", "care_event"] as const;

export const ENTRY_BEHAVIOR_RULES = [
  "no_chat_behavior",
  "no_context_loss_on_reentry",
  "entry_is_state_reconciliation",
  "greetings_trigger_state_of_care",
  "ingestion_first_no_setup_wizard",
] as const;

/** Greeting / non-semantic patterns — classify as SESSION_REENTRY_EVENT */
export const SESSION_REENTRY_GREETING_PATTERNS = [
  /^(?:hi|hello|hey|yo|hiya|howdy)\b/i,
  /^(?:hi|hello|hey)\s+solenos\b/i,
  /^solenos\b/i,
  /^solenos[,.!?\s]*(?:hi|hello|hey)?\s*$/i,
  /^(?:good\s+(?:morning|afternoon|evening))\b/i,
  /^(?:what'?s\s+up|sup)\b/i,
  /^(?:how\s+are\s+you)\b/i,
  /^(?:how'?s\s+it\s+going)\b/i,
] as const;

/**
 * Caregiver-facing orientation after a greeting — never chatbot companionship.
 * Do not lead with Hi/Hello/Hey. Guide back to the Care Record.
 */
export const GREETING_ORIENTATION = {
  newUser:
    "Start by sharing information about the person you are caring for. SolenOS will help organize events, changes, and important details over time.",
  returning:
    "Your Care Record continues from where you left off. You can add a new update, upload information, or review what is currently understood.",
  howAreYou:
    "SolenOS is ready to organize care information. Share an update, upload a document, or review the Care Record.",
  forbiddenPhrases: [
    "I'm always here for you",
    "I'm happy to chat",
    "Tell me anything, I'm listening",
    "I'm sorry you are going through this",
    "How can I help",
  ],
} as const;

export const GREETING_BEHAVIOR_RULES = [
  "acknowledge_briefly_via_state_not_chat",
  "never_companion_or_therapist_persona",
  "guide_back_to_care_record",
  "do_not_answer_how_are_you_as_human",
  "greeting_never_main_interaction",
] as const;

/** Zero-onboarding entry — forward content, no setup wizard */
export const INGESTION_READY_PROMPT =
  "Forward any care-related content — WhatsApp messages, voice notes, PDFs, images, or plain text.";

/** Care-related signals — presence means CARE_EVENT, not re-entry */
export const CARE_SEMANTIC_SIGNALS = [
  /\b(fell|fall|fallen|tripped|injur\w*|pain|fever|symptom|confus\w*|agitat\w*)\b/i,
  /\b(wander\w*|refus\w*|eat\w*|appetite|meal|sleep|mobility|walker|wheelchair|hospital|er\b|911)\b/i,
  /\b(medication|med|pill|dose|prescription|insulin|discharge)\b/i,
  /\b(appointment|follow[- ]?up|doctor|nurse|cardiolog\w*|therap\w*)\b/i,
  /\b(mom|dad|mother|father|patient|care recipient|husband|wife|grandma|grandpa)\b/i,
  /\b(worse|better|improv\w*|declin\w*|stable|unchanged)\b/i,
  /\b(book|schedule|need to|remind|task|call\b)/i,
  /\b(insurance|claim|billing|coordination)\b/i,
  /\b(yesterday|today|last night|this morning|this week|\d{1,2}[/-]\d{1,2})\b/i,
  /\b(behavior|agitated|sundown\w*|hallucin\w*|deliri\w*)\b/i,
] as const;

/** Product thesis — event-driven state machine (CareContextRoot = CareState) */
export const CARE_STATE_DEFINITION =
  "Solenos is an event-driven state machine that transforms fragmented caregiver inputs into a continuously updated, shared care state.";
