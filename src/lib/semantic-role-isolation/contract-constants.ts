/** SolenOS — Semantic Role Isolation Contract (implementation enforcement). */



export const SEMANTIC_ROLE_IDENTITY =

  "a deterministic cognitive decomposition engine that converts unstructured caregiver input into structured clarity under uncertainty";



export const SEMANTIC_ROLE_FINAL_IDENTITY = SEMANTIC_ROLE_IDENTITY;



export const SEMANTIC_ROLE_ONE_LINE_TRUTH =

  "Trust comes from deterministic structure, semantic stability, explicit uncertainty, and predictable cognitive decomposition — NOT from intelligence, personality, or conversation.";



export const SEMANTIC_ROLE_CORE_RULE =

  "what_is_happening holds grounded interpretation and explanation ONLY. All other fields hold one semantic role with zero overlap.";



export const SEMANTIC_ROLE_PRIORITY_ORDER = [

  "Safety and urgency escalation",

  "Grounding to available evidence",

  "Semantic role isolation",

  "Output schema compliance",

  "Readability and compression",

] as const;



export const SEMANTIC_ROLE_FAILURE_MODEL =

  "SolenOS fails when unsupported inference appears, sections overlap in meaning, cross-field leakage occurs, compression limits are exceeded, or the system behaves conversationally.";



export const SEMANTIC_ROLE_FIELD_CONTRACTS = {

  what_is_happening: {

    role: "grounded interpretation and explanation",

    allowed: ["paraphrasing", "narrative compression", "situation clarification", "grounded interpretation"],

    forbidden: ["recommendations", "prioritization", "urgency classification", "unsupported inference"],

  },

  what_matters_now: {

    role: "prioritization engine",

    // Caregiver Reality Principle 5 (crisis anticipation): uncertainty reduction — NOT prioritization theater.
    // @see ../caregiver-reality-principles/contract-constants.ts CAREGIVER_REALITY_PRINCIPLES[4]

    allowed: ["urgent signals", "priority items", "immediate focus points"],

    forbidden: ["explanation", "storytelling", "reasoning", "speculation"],

  },

  what_to_ask_next: {

    role: "information gap detector",

    allowed: ["clarifying questions", "information gathering prompts"],

    forbidden: ["advice", "recommendations", "reasoning", "interpretation"],

  },

  risk_level: {

    role: "urgency classification",

    allowed: ["low", "medium", "high", "critical"],

    forbidden: ["justification", "reasoning", "explanation"],

  },

  what_can_wait: {

    role: "cognitive load offloading",

    // Caregiver Reality Principle 5 (crisis anticipation): permission to release vigilance on non-urgent items — uncertainty reduction, not ranking theater.
    // @see ../caregiver-reality-principles/contract-constants.ts CAREGIVER_REALITY_PRINCIPLES[4]

    allowed: ["non-urgent concerns", "delayed tasks", "deprioritized items"],

    forbidden: ["urgent content", "explanation", "reasoning"],

  },

  follow_up_items: {

    role: "action queue",

    allowed: ["observations", "information gathering", "escalation actions", "monitoring actions"],

    forbidden: ["explanation", "prioritization", "reasoning", "interpretation"],

  },

} as const;



export const SEMANTIC_ROLE_VALIDATION_PIPELINE = [

  "Extract explicit input facts",

  "Assign semantic roles",

  "Ensure no unsupported inference",

  "Ensure section isolation",

  "Validate risk consistency",

  "Confirm schema correctness",

  "Enforce output compression",

] as const;


