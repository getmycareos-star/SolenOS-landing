import type { CareEventType, UncertaintyLevel } from "./types";

import type { InputProvenance } from "./types";



const FALL_PATTERN = /\b(fell|fall|fallen|tripped|slipped)\b/i;

/** Aligned with Living Care Record classifyCareEventKind — no bare started/stopped/changed. */

const MED_PATTERN =

  /\b(medication|medicine|medications|medicines|prescription|dose|doses|mg|pill|pills|rx)\b|\b(started|stopped|changed)\s+(her|his|their|the|a|an)\s+\w*(med|pill|dose|rx)/i;

const APPT_PATTERN = /\b(appointment|doctor|clinic|hospital|visit|specialist)\b/i;

const SYMPTOM_PATTERN = /\b(pain|fever|confus|dizzy|nausea|vomit|bleed|swell|weak|tired|sleep)\b/i;



export function inferEventType(content: string): CareEventType {

  const text = content.trim();

  if (!text) return "unknown";

  if (FALL_PATTERN.test(text)) return "fall";

  if (MED_PATTERN.test(text)) return "medication_change";

  if (APPT_PATTERN.test(text)) return "appointment";

  if (SYMPTOM_PATTERN.test(text)) return "symptom";

  return "observation";

}



export function deriveUncertaintyLevel(provenance: InputProvenance): UncertaintyLevel {

  if (provenance.input_type === "text" || provenance.input_type === "document") return "low";

  if (provenance.transcript_uncertain) return "medium";

  const confidence = provenance.recognition_confidence;

  if (confidence == null) return "medium";

  if (confidence < 0.7) return "medium";

  return "low";

}



export function deriveConfidence(provenance: InputProvenance): number | null {

  // Voice is future (ADR-018) — no caregiver-facing confidence from capture type.

  if (provenance.input_type !== "voice") return null;

  return provenance.recognition_confidence ?? null;

}


