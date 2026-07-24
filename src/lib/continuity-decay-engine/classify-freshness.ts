import type { CanonicalCareEvent } from "../situation-entry/types";

import type { FreshnessTier } from "./types";



const SHORT_LIVED_PATTERNS = [

  /\b(pain|sleep|mood|agitat|anxious|behavior|symptom|stress|appetite|swallow|wander|confus)\b/i,

];



const MEDIUM_LIVED_PATTERNS = [

  /\b(medication|med|pill|prescription|care\s+team|routine|appointment|follow[- ]?up|therapy)\b/i,

];



const LONG_LIVED_PATTERNS = [

  /\b(diagnos|relationship|living\s+arrangement|date\s+of\s+birth|residence|care\s+facility)\b/i,

];



export function classifyEventFreshness(event: CanonicalCareEvent): FreshnessTier {

  const text = `${event.extracted_type} ${event.raw_input} ${Object.values(event.attributes).join(" ")}`;



  if (event.extracted_type === "behavioral_change" || event.extracted_type === "observation") {

    if (SHORT_LIVED_PATTERNS.some((p) => p.test(text))) return "short_lived";

    return "short_lived";

  }



  if (LONG_LIVED_PATTERNS.some((p) => p.test(text))) return "long_lived";

  if (MEDIUM_LIVED_PATTERNS.some((p) => p.test(text))) return "medium_lived";

  if (SHORT_LIVED_PATTERNS.some((p) => p.test(text))) return "short_lived";



  if (event.extracted_type === "document_fact") return "long_lived";

  if (event.extracted_type === "follow_up" || event.extracted_type === "contact_event") {

    return "medium_lived";

  }

  if (event.extracted_type === "incident") return "short_lived";



  return "medium_lived";

}



export function objectLabel(event: CanonicalCareEvent): string {

  const entity = event.entities[0]?.label;

  if (entity) return `${event.extracted_type.replace(/_/g, " ")} — ${entity}`;

  return event.raw_input.slice(0, 80);

}


