/**
 * Deterministic signal extraction for legacy process pipeline (Path B / ops).
 * Returns a SignalVector — never caregiver-facing product logic.
 */

import type { SignalVector } from "./types";
import { EMPTY_SIGNALS } from "./types";

const URGENCY_PATTERNS: Array<{ re: RegExp; score: number }> = [
  { re: /\b(can't breathe|cannot breathe|unresponsive|not breathing)\b/i, score: 0.95 },
  { re: /\b(chest pain|stroke|seizure|911|emergency)\b/i, score: 0.9 },
  { re: /\b(fell|fall|bleeding|oxygen)\b/i, score: 0.55 },
];

const MEDICAL_ENTITY_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\boxygen\b/i, label: "oxygen" },
  { re: /\bmedication|medicine|meds?\b/i, label: "medication" },
  { re: /\bdose|pill|prescription\b/i, label: "medication" },
  { re: /\bhospital|discharge|urgent care\b/i, label: "care_setting" },
];

/**
 * Extract a shallow signal vector from raw caregiver text.
 * Heuristic only — Path A Living Care Record does not depend on this.
 */
export function extractSignals(raw: string): SignalVector {
  const text = raw.trim();
  if (!text) return { ...EMPTY_SIGNALS };

  const urgency_signals = URGENCY_PATTERNS.filter((p) => p.re.test(text)).map(
    (p) => p.score,
  );

  const medical_entities = [
    ...new Set(
      MEDICAL_ENTITY_PATTERNS.filter((p) => p.re.test(text)).map((p) => p.label),
    ),
  ];

  const uncertainty_markers: string[] = [];
  if (/\b(not sure|don't know|unsure|uncertain|can't remember)\b/i.test(text)) {
    uncertainty_markers.push("explicit_uncertainty");
  }
  if (/\?/.test(text)) uncertainty_markers.push("question");

  let emotional_intensity = 0.2;
  if (/\b(overwhelmed|exhausted|scared|terrified|desperate)\b/i.test(text)) {
    emotional_intensity = 0.75;
  } else if (/\b(worried|frustrated|sad|guilty|stressed)\b/i.test(text)) {
    emotional_intensity = 0.5;
  }

  const context_entities: string[] = [];
  if (/\b(doctor|nurse|hospital|clinic)\b/i.test(text)) {
    context_entities.push("clinical_setting");
  }
  if (/\b(brother|sister|family|daughter|son)\b/i.test(text)) {
    context_entities.push("family_context");
  }

  const inferred: SignalVector["inferred"] = [];
  if (/\b(missed|forgot).{0,40}\b(med|dose|appointment)\b/i.test(text)) {
    inferred.push({ signal: "missed care task", confidence: 0.55 });
  }
  if (
    /\b(worse|declining|getting worse)\b/i.test(text) &&
    medical_entities.length > 0
  ) {
    inferred.push({ signal: "possible clinical decline", confidence: 0.4 });
  }

  return {
    urgency_signals,
    medical_entities,
    emotional_intensity,
    uncertainty_markers,
    context_entities,
    inferred,
  };
}
