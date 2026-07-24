/** Shared valid SolenOS payload — 5-field semantic role decomposition schema. */

export const VERIFY_VALID_SOLENOS = {
  what_is_happening:
    "Evening medication was missed. These are the only facts stated in the input.",
  what_matters_now:
    "Confirming whether the missed evening dose was taken is the main immediate focus.",
  what_to_ask_next: "[ ] Did she take the evening dose?",
  risk_level: "medium" as const,
  what_can_wait:
    "Insurance calls and long-term scheduling can wait until medication status is clarified.",
};

/** Canonical example from semantic role contract. */
export const VERIFY_SEMANTIC_ROLE_EXAMPLE = {
  what_is_happening:
    "The father is not eating, appears unhappy, and is not taking his medication. These are the only facts stated in the input.",
  what_matters_now:
    "Not taking medication and not eating are the main immediate signals to focus on.",
  what_to_ask_next:
    "[ ] When did he stop eating or reduce food intake?\n[ ] Is he refusing medication or unable to take it?\n[ ] Has anything changed recently in his routine or health?",
  risk_level: "medium" as const,
  what_can_wait:
    "Trying to understand emotional or long-term causes can wait until basic intake and medication issues are clarified.",
};
