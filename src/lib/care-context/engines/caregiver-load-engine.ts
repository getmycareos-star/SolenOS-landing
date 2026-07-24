import type { CareContext, CaregiverLoadAssessment, LoadFactor } from "../types";

/**
 * Caregiver Load Engine — continuously estimates caregiver burden.
 * Uses open issues, crisis frequency, care complexity, interrupted continuity, prolonged uncertainty.
 */
export function assessCaregiverLoad(context: CareContext): CaregiverLoadAssessment {
  const now = new Date().toISOString();
  const factors: LoadFactor[] = [];

  const burdenEvents = context.timeline.filter((e) =>
    /\b(exhaust(?:ed|ion)|burn(?:out|ed)|overwhelm(?:ed)?|can't cope|stressed|no sleep)\b/i.test(
      e.description,
    ),
  );
  if (burdenEvents.length > 0) {
    factors.push({
      factor: "Caregiver exhaustion or burnout signals",
      weight: Math.min(burdenEvents.length * 15, 40),
      evidence: burdenEvents.map((e) => e.description),
    });
  }

  const crisisEvents = context.timeline.filter((e) =>
    /\b(emergency|er\b|hospital|911|crisis|urgent|wander(?:ing)?)\b/i.test(
      e.description,
    ),
  );
  if (crisisEvents.length > 0) {
    factors.push({
      factor: "Crisis or high-acuity events",
      weight: Math.min(crisisEvents.length * 12, 35),
      evidence: crisisEvents.map((e) => e.description),
    });
  }

  if (context.uncertainties.length >= 2) {
    factors.push({
      factor: "Prolonged uncertainty",
      weight: context.uncertainties.length * 8,
      evidence: context.uncertainties,
    });
  }

  const complexityMarkers = context.timeline.filter((e) =>
    /\b(medication|med|night|supervision|24\s*\/\s*7|multiple|appointment)\b/i.test(
      e.description,
    ),
  );
  if (complexityMarkers.length >= 3) {
    factors.push({
      factor: "Care complexity",
      weight: Math.min(complexityMarkers.length * 5, 25),
      evidence: complexityMarkers.slice(0, 5).map((e) => e.description),
    });
  }

  const unresolvedQuestions = context.timeline.filter(
    (e) => e.source === "question",
  );
  if (unresolvedQuestions.length > 0) {
    factors.push({
      factor: "Unresolved caregiver questions",
      weight: unresolvedQuestions.length * 10,
      evidence: unresolvedQuestions.map((e) => e.description),
    });
  }

  const score = Math.min(
    factors.reduce((sum, f) => sum + f.weight, 0),
    100,
  );

  let level: CaregiverLoadAssessment["level"];
  if (score >= 70) level = "critical";
  else if (score >= 45) level = "high";
  else if (score >= 20) level = "moderate";
  else level = "low";

  return { level, score, factors, assessedAt: now };
}
