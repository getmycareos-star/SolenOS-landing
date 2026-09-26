import {
  IDENTITY_TIME_WINDOWS,
  IDENTITY_CONFIDENCE,
  EVIDENCE_RELATIONS,
  EVENT_IDENTITY_FAILURE_LABELS,
} from "./contract-constants";
import type {
  IncomingEvidence,
  ExistingEvent,
  IdentityResolutionResult,
} from "./types";
import { temporalSortKey } from "../time-model";
import { parseEventTimeFromText } from "../time-model";
import { semanticEventMatch } from "./semantic-match";

function getEventTimeMs(event: IncomingEvidence | ExistingEvent, referenceTime: string): number {
  const parsed = parseEventTimeFromText(
    "content" in event ? event.content : event.label,
    referenceTime
  );
  if (parsed.event_time) {
    return new Date(temporalSortKey(parsed.event_time, referenceTime)).getTime();
  }
  return new Date(referenceTime).getTime();
}

/** Check for repeated stable measurements (same value, same unit) */
function isRepeatedStableMeasurement(
  incoming: IncomingEvidence,
  existing: ExistingEvent,
): { repeated: boolean; confidence: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  // Same measurement type
  const incomingMeasurement = incoming.attributes?.measurement_type as string;
  const existingMeasurement = existing.attributes?.measurement_type as string;
  if (incomingMeasurement && existingMeasurement && incomingMeasurement === existingMeasurement) {
    score += 0.3;
    reasons.push(`Same measurement type: ${incomingMeasurement}`);
  }

  // Same value
  const incomingValue = incoming.attributes?.measurement_value as number;
  const existingValue = existing.attributes?.measurement_value as number;
  if (incomingValue !== undefined && existingValue !== undefined && incomingValue === existingValue) {
    score += 0.4;
    reasons.push(`Identical value: ${incomingValue}`);
  }

  // Same unit
  const incomingUnit = incoming.attributes?.measurement_unit as string;
  const existingUnit = existing.attributes?.measurement_unit as string;
  if (incomingUnit && existingUnit && incomingUnit === existingUnit) {
    score += 0.15;
    reasons.push(`Same unit: ${incomingUnit}`);
  }

  // Temporal pattern: regular intervals suggest monitoring
  const incomingTime = getEventTimeMs(incoming, incoming.captured_at);
  const existingTime = getEventTimeMs(existing, existing.created_at);
  const diffHours = Math.abs(incomingTime - existingTime) / (1000 * 60 * 60);
  if (diffHours > 1 && diffHours <= 168) { // 1 hour to 1 week
    score += 0.15;
    reasons.push(`Regular monitoring interval: ${diffHours.toFixed(1)}h`);
  }

  const repeated = score >= 0.6;
  return { repeated, confidence: Math.min(score, 1), reasons };
}

/** DUP-016: Stable weight repeatedly documented */
export function detectRepeatedStableWeight(
  incoming: IncomingEvidence,
  existingEvents: ExistingEvent[],
): IdentityResolutionResult | null {
  const weightKeywords = ["weight", "weighs", "kg", "lbs", "pounds"];
  const incomingHasWeight = weightKeywords.some(k => incoming.content.toLowerCase().includes(k));
  if (!incomingHasWeight) return null;

  const existingWeights = existingEvents.filter(e =>
    e.person_id === incoming.person_id &&
    weightKeywords.some(k => e.content.toLowerCase().includes(k))
  );

  if (existingWeights.length < 1) return null;

  // Check against most recent weight
  const recentWeight = existingWeights.sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0];

  const { repeated, confidence, reasons } = isRepeatedStableMeasurement(incoming, recentWeight);
  if (repeated && confidence >= IDENTITY_CONFIDENCE.medium) {
    return {
      incoming_id: incoming.id,
      resolution: "ongoing_state",
      confidence,
      matched_event_id: recentWeight.id,
      evidence_relation: "repeated_observation_stable",
      reasoning: `Repeated stable weight measurement. ${reasons.join("; ")}. Three measurements, one stable pattern. Not three weight-change events.`,
      failure_labels: ["ONGOING_STATE_AS_NEW_EVENT", "REPEATED_OBSERVATION_AS_CHANGE"],
      requires_clarification: false,
      combined_evidence: [...recentWeight.evidence_ids, incoming.id],
    };
  }

  return null;
}

/** DUP-017: Repeated walker use */
export function detectRepeatedWalkerUse(
  incoming: IncomingEvidence,
  existingEvents: ExistingEvent[],
): IdentityResolutionResult | null {
  const walkerKeywords = ["walker", "walking aid", "mobility aid", "cane", "rollator"];
  const incomingHasWalker = walkerKeywords.some(k => incoming.content.toLowerCase().includes(k));
  if (!incomingHasWalker) return null;

  const existingWalker = existingEvents.filter(e =>
    e.person_id === incoming.person_id &&
    walkerKeywords.some(k => e.content.toLowerCase().includes(k))
  );

  if (existingWalker.length < 1) return null;

  // Check for "still using", "used yesterday", "uses today" pattern
  const persistenceWords = ["still", "continues", "using", "uses", "used"];
  const isPersistence = persistenceWords.some(w => incoming.content.toLowerCase().includes(w));

  const recentWalker = existingWalker.sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0];

  const { match: semanticMatch, confidence: semanticConf, reasons: semanticReasons } = semanticEventMatch(
    incoming,
    recentWalker
  );

  if (semanticMatch && (isPersistence || semanticConf >= IDENTITY_CONFIDENCE.medium)) {
    return {
      incoming_id: incoming.id,
      resolution: "ongoing_state",
      confidence: Math.max(semanticConf, IDENTITY_CONFIDENCE.medium),
      matched_event_id: recentWalker.id,
      evidence_relation: "repeated_observation_persistent",
      reasoning: `Repeated observations of ongoing functional state (walker use). ${semanticReasons.join("; ")}. Not separate mobility changes.`,
      failure_labels: ["ONGOING_STATE_AS_NEW_EVENT", "REPEATED_OBSERVATION_AS_CHANGE"],
      requires_clarification: false,
      combined_evidence: [...recentWalker.evidence_ids, incoming.id],
    };
  }

  return null;
}

/** DUP-018: Repeated stable medication status */
export function detectRepeatedStableMedication(
  incoming: IncomingEvidence,
  existingEvents: ExistingEvent[],
): IdentityResolutionResult | null {
  const medStatusKeywords = ["still taking", "continue", "ongoing", "maintain", "unchanged"];
  const incomingHasStatus = medStatusKeywords.some(k => incoming.content.toLowerCase().includes(k));
  if (!incomingHasStatus) return null;

  const existingMeds = existingEvents.filter(e =>
    e.person_id === incoming.person_id &&
    (e.extracted_type === "medication_started" || e.extracted_type === "medication_changed" ||
      e.content.toLowerCase().includes("taking") || e.content.toLowerCase().includes("medication"))
  );

  if (existingMeds.length === 0) return null;

  const recentMed = existingMeds.sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0];

  // Check for same medication and dose
  const incomingMed = extractMedicationDetails(incoming.content);
  const existingMed = extractMedicationDetails(recentMed.content);

  if (incomingMed && existingMed &&
    incomingMed.name.toLowerCase() === existingMed.name.toLowerCase() &&
    incomingMed.dose === existingMed.dose) {
    return {
      incoming_id: incoming.id,
      resolution: "ongoing_state",
      confidence: IDENTITY_CONFIDENCE.high,
      matched_event_id: recentMed.id,
      evidence_relation: "repeated_observation_stable",
      reasoning: `Repeated confirmation of stable medication state (${incomingMed.name} ${incomingMed.dose}). No new dose-change event.`,
      failure_labels: ["ONGOING_STATE_AS_NEW_EVENT", "REPEATED_OBSERVATION_AS_CHANGE"],
      requires_clarification: false,
      combined_evidence: [...recentMed.evidence_ids, incoming.id],
    };
  }

  return null;
}

function extractMedicationDetails(text: string): { name: string; dose: string } | null {
  // Simple extraction: "medication 10 mg" or "taking 20 mg of X"
  const doseMatch = text.match(/(\d+(?:\.\d+)?)\s*mg/i);
  const nameMatch = text.match(/(?:taking|still taking|on|prescribed)\s+(\w+(?:\s+\w+)?)/i);
  if (doseMatch) {
    return {
      name: nameMatch ? nameMatch[1] : "medication",
      dose: doseMatch[0],
    };
  }
  return null;
}

/** DUP-019: Repeated assistance with bathing */
export function detectRepeatedBathingAssistance(
  incoming: IncomingEvidence,
  existingEvents: ExistingEvent[],
): IdentityResolutionResult | null {
  const bathingKeywords = ["shower", "bathe", "bathing", "washed", "helped shower", "assisted shower"];
  const incomingHasBathing = bathingKeywords.some(k => incoming.content.toLowerCase().includes(k));
  if (!incomingHasBathing) return null;

  const existingBathing = existingEvents.filter(e =>
    e.person_id === incoming.person_id &&
    bathingKeywords.some(k => e.content.toLowerCase().includes(k))
  );

  if (existingBathing.length < 2) return null; // Need pattern

  // Daily notes pattern suggests persistent dependence
  return {
    incoming_id: incoming.id,
    resolution: "ongoing_state",
    confidence: IDENTITY_CONFIDENCE.medium,
    matched_event_id: existingBathing[0].id,
    evidence_relation: "repeated_observation_persistent",
    reasoning: `Daily bathing assistance notes establish persistent functional dependence. Not a new functional decline each day.`,
    failure_labels: ["ONGOING_STATE_AS_NEW_EVENT", "REPEATED_OBSERVATION_AS_CHANGE"],
    requires_clarification: false,
    combined_evidence: existingBathing.flatMap(e => e.evidence_ids).concat(incoming.id),
  };
}

/** DUP-020: Repeated nighttime confusion */
export function detectRepeatedNighttimeConfusion(
  incoming: IncomingEvidence,
  existingEvents: ExistingEvent[],
): IdentityResolutionResult | null {
  const confusionKeywords = ["confused", "confusion", "disoriented", "delirium"];
  const nightKeywords = ["overnight", "night", "nighttime", "during the night"];
  const incomingHasConfusion = confusionKeywords.some(k => incoming.content.toLowerCase().includes(k));
  const incomingHasNight = nightKeywords.some(k => incoming.content.toLowerCase().includes(k));

  if (!incomingHasConfusion || !incomingHasNight) return null;

  const existingConfusion = existingEvents.filter(e =>
    e.person_id === incoming.person_id &&
    confusionKeywords.some(k => e.content.toLowerCase().includes(k)) &&
    nightKeywords.some(k => e.content.toLowerCase().includes(k))
  );

  if (existingConfusion.length < 1) return null;

  // Pattern: recurrent vs persistent - check for resolution periods
  const sortedEvents = existingConfusion.sort((a, b) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  // Check if there are clear gaps (resolution) between episodes
  let hasGaps = false;
  for (let i = 1; i < sortedEvents.length; i++) {
    const gap = (new Date(sortedEvents[i].created_at).getTime() - new Date(sortedEvents[i-1].created_at).getTime()) / (1000 * 60 * 60);
    if (gap > 24) { // More than 24h gap suggests separate episodes
      hasGaps = true;
      break;
    }
  }

  const resolution = hasGaps ? "recurrence" : "ongoing_state";
  const relation = hasGaps ? "explicit_recurrence" : "repeated_observation_persistent";

  return {
    incoming_id: incoming.id,
    resolution,
    confidence: IDENTITY_CONFIDENCE.medium,
    matched_event_id: sortedEvents[0].id,
    evidence_relation: relation,
    reasoning: hasGaps
      ? `Recurrent nighttime confusion episodes with resolution gaps. Multiple observations support frequency.`
      : `Persistent nighttime confusion pattern. Multiple observations support ongoing state. Not automatically three unrelated cognitive changes.`,
    failure_labels: hasGaps ? ["RECURRING_EVENT_COLLAPSE"] : ["ONGOING_STATE_AS_NEW_EVENT"],
    requires_clarification: false,
    combined_evidence: sortedEvents.flatMap(e => e.evidence_ids).concat(incoming.id),
  };
}
 
/** DUP-017, 018, 019, 020: General repeated persistent state detection
 * Handles cases like "Still using walker", "Still taking medication", 
 * "Still needs assistance", "Still confused overnight" etc.
 * Detects when multiple observations describe the SAME ongoing state,
 * not separate events.
 */
export function detectRepeatedPersistentState(
  incoming: IncomingEvidence,
  existingEvents: ExistingEvent[],
): IdentityResolutionResult | null {
  const persistenceWords = ["still", "continues", "ongoing", "maintains", "keeps", "persist"];
  const persistenceWord = persistenceWords.find(w => incoming.content.toLowerCase().includes(w));
  if (!persistenceWord) return null;

  const personEvents = existingEvents.filter(e => e.person_id === incoming.person_id);
  if (personEvents.length < 1) return null;

  // Find best semantic match among existing events
  let bestMatch: { event: ExistingEvent; confidence: number; reasons: string[] } | null = null;
  
  for (const existing of personEvents) {
    const matchResult = semanticEventMatch(incoming, existing);
    // For persistent state, accept lower semantic confidence when persistence language is present
    if (matchResult.confidence > (bestMatch?.confidence ?? 0)) {
      bestMatch = { event: existing, confidence: matchResult.confidence, reasons: matchResult.reasons };
    }
  }

  // With persistence language, accept very low threshold since persistence is strong signal
  const persistentThreshold = 0.05;
  if (bestMatch && bestMatch.confidence >= persistentThreshold) {
    return {
      incoming_id: incoming.id,
      resolution: "ongoing_state",
      confidence: Math.max(bestMatch.confidence, IDENTITY_CONFIDENCE.medium),
      matched_event_id: bestMatch.event.id,
      evidence_relation: "repeated_observation_persistent",
      reasoning: `Repeated observation of ongoing state. Persistence language ("${persistenceWord}") with semantic match to prior observation. ${bestMatch.reasons.join("; ")}. Not a new event.`,
      failure_labels: ["ONGOING_STATE_AS_NEW_EVENT", "REPEATED_OBSERVATION_AS_CHANGE"],
      requires_clarification: false,
      combined_evidence: [...bestMatch.event.evidence_ids, incoming.id],
    };
  }

  return null;
}

/** Main repeated observation detection orchestrator (Category 9D) */
export function detectRepeatedObservations(
  incoming: IncomingEvidence,
  existingEvents: ExistingEvent[],
): IdentityResolutionResult | null {
  const detectors = [
    detectRepeatedStableWeight,
    detectRepeatedWalkerUse,
    detectRepeatedStableMedication,
    detectRepeatedBathingAssistance,
    detectRepeatedNighttimeConfusion,
    detectRepeatedPersistentState,
  ];

  for (const detector of detectors) {
    const result = detector(incoming, existingEvents);
    if (result) return result;
  }

  return null;
}