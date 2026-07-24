import type { CanonicalCareEvent } from "../situation-entry/types";
import type { DareIngestResult } from "../data-acquisition-resilience/types";
import type { ProvenanceRecord, ResponseConfidenceAssessment, ResponseConfidenceLevel } from "./types";

export function assessResponseConfidence(input: {
  events: CanonicalCareEvent[];
  provenance_records: ProvenanceRecord[];
  unresolved_questions: string[];
  dare: DareIngestResult | null;
}): ResponseConfidenceAssessment {
  const evidence_count = input.events.filter(
    (e) => e.status === "committed" || e.status === "provisional",
  ).length;

  const verified_count = input.provenance_records.filter(
    (p) => p.verification_status === "user_confirmed",
  ).length;

  const unresolved_count =
    input.unresolved_questions.length +
    input.events.filter((e) => e.status === "provisional" || e.status === "unparsed_raw").length +
    (input.dare?.conflicts.length ?? 0);

  let level: ResponseConfidenceLevel;
  let reason: string;

  if (evidence_count === 0) {
    level = "insufficient";
    reason = "No validated CareEvents available to support a conclusion.";
  } else if (
    verified_count >= evidence_count * 0.7 &&
    unresolved_count === 0
  ) {
    level = "high";
    reason = "Evidence is complete and verified.";
  } else if (evidence_count >= 1 && unresolved_count <= 2) {
    level = "medium";
    reason = "Evidence is mostly complete but contains unresolved uncertainty.";
  } else if (evidence_count >= 1) {
    level = "low";
    reason = "Important information is missing or unverified.";
  } else {
    level = "insufficient";
    reason = "The system cannot answer reliably with available evidence.";
  }

  return {
    level,
    reason,
    evidence_count,
    verified_count,
    unresolved_count,
  };
}

export function confidenceLevelLabel(level: ResponseConfidenceLevel): string {
  const labels: Record<ResponseConfidenceLevel, string> = {
    high: "High — evidence complete and verified",
    medium: "Medium — mostly complete, some uncertainty",
    low: "Low — important information missing",
    insufficient: "Insufficient — cannot answer reliably",
  };
  return labels[level];
}
