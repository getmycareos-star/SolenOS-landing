/**
 * Evidence-only attention risk — held caregiver text, never event kind alone.
 * SoT: docs/17-canonical-architecture/spine-build-sequence.md (Slice 1.2)
 */

import type { ResponseRiskLevel } from "./types";
import {
  classifyCareSignalSeverity,
  hasPhysicalHarmImmediacyMarkers,
  hasPhysicalHarmSeverityMarkers,
  hasRecentHarmTiming,
  mentionsPhysicalHarmEvent,
} from "../care-epistemics";
import {
  isImmediateDangerLanguage,
  isRetrospectiveCareReport,
} from "../mvp-input-architecture";

export const RISK_FROM_EVIDENCE_PURPOSE =
  "Response Contract risk_level from held care evidence — never from classifyCareEventKind alone.";

function hasOngoingHarmConcern(text: string): boolean {
  return /\b(still|ongoing|won'?t|can'?t|cannot|unable|bleeding|severe pain|not responding|won'?t wake)\b/i.test(
    text,
  );
}

function lineWarrantsHarmAttention(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (isRetrospectiveCareReport(t) && !hasOngoingHarmConcern(t)) return false;
  if (hasPhysicalHarmSeverityMarkers(t)) return true;
  if (hasPhysicalHarmImmediacyMarkers(t) && mentionsPhysicalHarmEvent(t)) return true;
  if (hasRecentHarmTiming(t) && mentionsPhysicalHarmEvent(t)) return true;
  return false;
}

/**
 * Infer risk from held observations — structural harm/immediacy/epistemic severity only.
 */
export function inferRiskFromHeldCareEvidence(params: {
  heldTexts: readonly string[];
  latestRawText: string;
}): ResponseRiskLevel {
  const lines = [...params.heldTexts, params.latestRawText]
    .map((t) => t.trim())
    .filter(Boolean);

  if (lines.some((t) => isImmediateDangerLanguage(t))) {
    return "high";
  }

  for (const text of lines) {
    if (lineWarrantsHarmAttention(text)) return "medium";
  }

  for (const text of lines) {
    if (classifyCareSignalSeverity(text) === "elevated_concern") {
      return "medium";
    }
  }

  return "low";
}
