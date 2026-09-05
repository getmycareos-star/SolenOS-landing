import type { ContinuousCareEventType } from "../care-record/types";

export const CROSS_DOMAIN_REASONING_PURPOSE =
  "Detect and represent relationships across different care domains without asserting causation.";

export const CROSS_DOMAIN_REASONING_DEFINING_PRINCIPLE =
  "Care situations cross domain boundaries. Connect domains without collapsing uncertainty.";

export const CROSS_DOMAIN_REASONING_STATUS = {
  module: "IMPLEMENTED" as const,
  notANewPillar: true,
} as const;

export const DOMAIN_CATEGORIES = [
  "medication",
  "symptom",
  "functional_status",
  "safety",
  "caregiver_observation",
  "hospitalization",
  "procedure",
  "treatment",
  "appointment",
  "provider",
  "care_setting",
  "cognitive",
  "behavioral",
  "care_plan",
  "equipment",
  "living_arrangement",
] as const;

export type DomainCategory = (typeof DOMAIN_CATEGORIES)[number];

export const RELATIONSHIP_STRENGTHS = [
  "EXPLICIT",
  "TEMPORAL",
  "CONTEXTUAL",
  "PATTERN",
  "SEMANTIC",
  "INFERRED",
] as const;

export type RelationshipStrength = (typeof RELATIONSHIP_STRENGTHS)[number];

export const SITUATION_STATUSES = [
  "detected",
  "supported",
  "evolving",
  "resolved",
  "no_longer_active",
  "open",
] as const;

export type SituationStatus = (typeof SITUATION_STATUSES)[number];

export const CONFIDENCE_LEVELS = ["low", "medium", "high"] as const;

export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

export const MINIMUM_DOMAINS_FOR_SITUATION = 2;
export const MINIMUM_EVENTS_FOR_SITUATION = 2;
export const MAX_SITUATIONS_PER_RECIPIENT = 8;

export const TEMPORAL_WINDOWS: Record<string, { near: number; far: number }> = {
  medication_symptom: { near: 14, far: 30 },
  medication_function: { near: 14, far: 30 },
  medication_safety: { near: 14, far: 30 },
  symptom_function: { near: 7, far: 14 },
  function_safety: { near: 7, far: 14 },
  caregiver_function: { near: 7, far: 14 },
  hospitalization_medication: { near: 30, far: 60 },
  hospitalization_function: { near: 30, far: 60 },
  default: { near: 14, far: 30 },
};

export const EXPLICIT_CONNECTION_PATTERNS = [
  /\bafter\s+(?:starting|stopping|changing|switching)\s+(?:the\s+)?(?:new\s+)?medication\b/i,
  /\bsince\s+(?:starting|stopping|changing|switching)\s+(?:the\s+)?(?:new\s+)?medication\b/i,
  /\b(?:started|began|noticed)\s+(?:having|showing|experiencing)\s+(?:new|increased|worse)\b/i,
  /\b(?:more|less|increased|decreased|worse|better)\s+(?:difficulty|trouble|problems)\b/i,
  /\b(?:following|after)\s+(?:the\s+)?(?:fall|hospital|discharge|appointment)\b/i,
  /\b(?:since|after)\s+(?:the\s+)?(?:fall|hospital|discharge|appointment)\b/i,
  /\b(?:related|connected|linked|because)\s+to\b/i,
  /\b(?:due to|because of|as a result of|resulting from)\b/i,
];

export const CONTEXTUAL_LINK_PATTERNS = [
  /\b(?:same|this)\s+(?:hospital|facility|clinic|stay|admission|discharge)\b/i,
  /\b(?:during|while)\s+(?:the\s+)?(?:hospital|stay|recovery|treatment)\b/i,
  /\b(?:new|recent|current)\s+(?:medication|meds?|prescription|dose)\b/i,
  /\b(?:home\s*care|home\s*health|nursing|therapy)\b/i,
  /\b(?:caregiver|family|mom|dad|husband|wife)\s+(?:noticed|reported|said|mentioned)\b/i,
];

export const DOMAIN_MAPPING_RULES: Array<{
  domain: DomainCategory;
  extractedTypes: string[];
  keywords: string[];
  attributeKeys: string[];
}> = [
  {
    domain: "medication",
    extractedTypes: ["decision", "document_fact"],
    keywords: [
      "medication", "medicine", "meds", "prescription", "dose", "dosage",
      "started", "stopped", "changed", "switched", "adjust", "pill", "tablet",
      "new medication", "medication change",
    ],
    attributeKeys: ["medication", "medications", "medication_name", "dose", "dosage"],
  },
  {
    domain: "symptom",
    extractedTypes: ["behavioral_change", "document_fact"],
    keywords: [
      "sleepy", "sleep", "dizzy", "confused", "tired", "fatigue", "pain",
      "nausea", "appetite", "eating", "drinking", "mood", "anxious", "agitated",
      "symptom", "symptoms", "complaint", "feeling", "unusually",
    ],
    attributeKeys: ["symptom", "symptoms", "sleep", "mood", "appetite"],
  },
  {
    domain: "functional_status",
    extractedTypes: ["behavioral_change"],
    keywords: [
      "walk", "walking", "mobility", "moved", "transferred", "balance", "gait",
      "dressing", "bathing", "eating", "hygiene", "toilet", "adl", "iadl",
      "independent", "assistance", "help", "difficulty", "struggling", "weak",
      "stagger", "wobble", "unsteady", "difficulty walking",
    ],
    attributeKeys: ["mobility", "adl", "iadl", "daily_function", "functional_status"],
  },
  {
    domain: "safety",
    extractedTypes: ["incident"],
    keywords: [
      "fall", "fell", "fallen", "injury", "injured", "hurt", "accident",
      "unsafe", "danger", "hazard", "wander", "wandering", "left alone",
      "supervision", "monitor", "alert",
    ],
    attributeKeys: ["safety", "fall", "incident", "injury"],
  },
  {
    domain: "caregiver_observation",
    extractedTypes: ["caregiver_note"],
    keywords: [
      "i noticed", "i saw", "i observed", "i think", "i feel", "i worried",
      "caregiver", "seems", "appears", "looks like", "unusual", "different",
      "noticed", "reported", "mentioned", "said", "mom seems", "dad seems",
    ],
    attributeKeys: ["caregiver_observation", "observation_type", "source"],
  },
  {
    domain: "hospitalization",
    extractedTypes: ["document_fact", "decision"],
    keywords: [
      "hospital", "admission", "discharge", "discharged", "stay", "admitted",
      "emergency room", "er visit", "ambulance", "inpatient", "outpatient",
    ],
    attributeKeys: ["hospital", "facility", "care_setting", "location"],
  },
  {
    domain: "cognitive",
    extractedTypes: ["behavioral_change", "document_fact"],
    keywords: [
      "confused", "confusion", "memory", "forget", "forgetting", "disoriented",
      "orientation", "recognize", "recognition", "word finding", "repeating",
      "lost", "getting lost", "doesn't know", "doesn't remember",
    ],
    attributeKeys: ["cognitive", "memory", "orientation"],
  },
  {
    domain: "behavioral",
    extractedTypes: ["behavioral_change", "document_fact"],
    keywords: [
      "agitated", "agitation", "anxious", "anxiety", "depressed", "depression",
      "irritable", "irritability", "wandering", "paranoia", "hallucination",
      "behavior", "behaviors", "mood", "emotional", "withdrawn",
    ],
    attributeKeys: ["behavior", "mood", "behavioral_change"],
  },
  {
    domain: "appointment",
    extractedTypes: ["appointment"],
    keywords: [
      "appointment", "visit", "doctor", "clinic", "checkup", "follow up",
      "follow-up", "specialist", "therapy", "session",
    ],
    attributeKeys: ["appointment", "provider", "specialist"],
  },
  {
    domain: "care_plan",
    extractedTypes: ["decision", "coordination_issue"],
    keywords: [
      "care plan", "instructions", "plan", "protocol", "guidelines",
      "home care", "home health", "nursing", "therapy", "rehab",
    ],
    attributeKeys: ["care_plan", "instructions", "plan"],
  },
  {
    domain: "equipment",
    extractedTypes: ["document_fact", "decision"],
    keywords: [
      "walker", "wheelchair", "cane", "hospital bed", "raised toilet",
      "grab bar", "equipment", "device", "aid", "assistive",
    ],
    attributeKeys: ["equipment", "device", "aid"],
  },
];

export const DOMAIN_COMPATIBILITY: Record<string, string[]> = {
  medication: ["symptom", "functional_status", "safety", "caregiver_observation", "cognitive", "behavioral"],
  symptom: ["functional_status", "safety", "caregiver_observation", "medication", "cognitive"],
  functional_status: ["safety", "caregiver_observation", "medication", "symptom", "equipment"],
  safety: ["functional_status", "medication", "symptom", "caregiver_observation", "hospitalization"],
  caregiver_observation: ["medication", "symptom", "functional_status", "safety", "behavioral", "cognitive"],
  hospitalization: ["medication", "functional_status", "safety", "care_plan", "appointment"],
  cognitive: ["behavioral", "functional_status", "medication", "caregiver_observation"],
  behavioral: ["cognitive", "functional_status", "medication", "caregiver_observation"],
  appointment: ["medication", "functional_status", "care_plan", "hospitalization"],
  care_plan: ["medication", "functional_status", "appointment", "hospitalization"],
  equipment: ["functional_status", "safety", "caregiver_observation"],
  procedure: ["functional_status", "safety", "medication", "hospitalization"],
  treatment: ["medication", "functional_status", "symptom", "procedure"],
  provider: ["appointment", "medication", "care_plan", "treatment"],
  care_setting: ["medication", "functional_status", "care_plan", "equipment"],
  living_arrangement: ["caregiver_observation", "functional_status", "care_plan", "safety"],
};
