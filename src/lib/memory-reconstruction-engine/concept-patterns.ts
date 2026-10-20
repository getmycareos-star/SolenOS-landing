import type { JourneyEventType } from "../care-journey-graph/types";
import type { MemoryConcept } from "./types";

/** Care concepts mappable to journey events — not free-text search. */
export const MEMORY_CONCEPTS: MemoryConcept[] = [
  {
    id: "appetite",
    label: "Appetite / eating",
    keywords: ["appetite", "eating", "food intake", "stopped eating", "eating less", "not eating"],
    event_types: ["symptom", "behaviour_change", "caregiver_observation"],
  },
  {
    id: "confusion",
    label: "Confusion",
    keywords: ["confusion", "confused", "disoriented", "memory", "cognitive"],
    event_types: ["symptom", "behaviour_change", "caregiver_observation"],
  },
  {
    id: "mobility",
    label: "Mobility",
    keywords: ["mobility", "walking", "walker", "wheelchair", "fall", "fell", "balance"],
    event_types: ["fall", "symptom", "behaviour_change", "caregiver_observation", "doctor_recommendation"],
  },
  {
    id: "medication",
    label: "Medication",
    keywords: ["medication", "medicine", "prescription", "drug", "dose", "antibiotic"],
    event_types: ["medication_started", "medication_stopped", "doctor_recommendation"],
  },
  {
    id: "pain",
    label: "Pain",
    keywords: ["pain", "ache", "hurt", "discomfort"],
    event_types: ["symptom", "caregiver_observation"],
  },
  {
    id: "sleep",
    label: "Sleep",
    keywords: ["sleep", "insomnia", "restless", "night", "waking"],
    event_types: ["symptom", "behaviour_change", "caregiver_observation"],
  },
  {
    id: "diagnosis",
    label: "Diagnosis",
    keywords: ["diagnosis", "diagnosed", "uti", "infection", "dementia", "condition"],
    event_types: ["diagnosis", "lab_result"],
  },
  {
    id: "hospital",
    label: "Hospital / emergency",
    keywords: ["hospital", "emergency", "er visit", "admitted", "discharge"],
    event_types: ["hospital_visit", "emergency_visit"],
  },
  {
    id: "legal",
    label: "Legal authority",
    keywords: ["power of attorney", "poa", "legal", "guardianship", "will", "trust"],
    event_types: ["legal_document", "decision"],
  },
  {
    id: "insurance",
    label: "Insurance / financial",
    keywords: ["insurance", "coverage", "claim", "benefits", "billing", "medicare"],
    event_types: ["insurance_update", "administrative", "decision"],
  },
  {
    id: "family",
    label: "Family care",
    keywords: ["family", "caregiver", "responsibility", "sibling", "daughter", "son"],
    event_types: ["family_conversation", "decision", "care_goal"],
  },
  {
    id: "appointment",
    label: "Appointments",
    keywords: ["appointment", "doctor visit", "specialist", "follow-up", "clinic"],
    event_types: ["appointment", "doctor_recommendation"],
  },
];

export function conceptFromQuery(query: string): MemoryConcept[] {
  const lower = query.toLowerCase();
  const matched: MemoryConcept[] = [];

  for (const concept of MEMORY_CONCEPTS) {
    if (concept.keywords.some((kw) => lower.includes(kw))) {
      matched.push(concept);
    }
  }

  if (matched.length === 0) {
    const tokens = lower
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 3 && !STOP_WORDS.has(t));
    if (tokens.length > 0) {
      matched.push({
        id: "custom",
        label: tokens.slice(0, 3).join(" "),
        keywords: tokens,
        event_types: [],
      });
    }
  }

  return matched;
}

const STOP_WORDS = new Set([
  "when",
  "what",
  "how",
  "did",
  "does",
  "has",
  "have",
  "been",
  "start",
  "started",
  "stop",
  "stopped",
  "well",
  "much",
  "about",
  "before",
  "after",
  "than",
  "this",
  "that",
  "with",
  "from",
  "into",
  "over",
  "time",
  "change",
  "changed",
  "first",
  "recent",
  "last",
  "most",
  "dad",
  "mom",
  "mother",
  "father",
  "parent",
]);

export function eventTypesForConcepts(concepts: MemoryConcept[]): JourneyEventType[] {
  const types = new Set<JourneyEventType>();
  for (const c of concepts) {
    for (const t of c.event_types) types.add(t);
  }
  return [...types];
}
