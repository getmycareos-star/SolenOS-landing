/**
 * Phase 7 — Behavioral observation layer (dementia-entry context).
 * Preserve observations. Never diagnose. Never assign symptoms as facts.
 */

export type BehavioralObservationRecord = {
  id: string;
  description: string;
  contributor_id: string;
  date: string;
  source: string;
  /** Always observation stance — never diagnosis. */
  stance: "observation";
};

const DIAGNOSIS_LEAK =
  /\b(worsening dementia|has dementia|diagnosed with|patient has|alzheimers disease progressing)\b/i;

/**
 * Normalize caregiver-facing observation language.
 * Rejects diagnosis framing; keeps family-observed language.
 */
export function preserveBehavioralObservation(params: {
  id: string;
  rawDescription: string;
  contributorId: string;
  date: string;
  source?: string;
}): BehavioralObservationRecord | null {
  const description = params.rawDescription.trim();
  if (!description) return null;
  if (DIAGNOSIS_LEAK.test(description)) {
    // Soften to observation stance — never ship diagnosis claim as Care Reality fact
    return {
      id: params.id,
      description: `Family observed: ${description.replace(DIAGNOSIS_LEAK, "changes").trim()}`,
      contributor_id: params.contributorId,
      date: params.date,
      source: params.source ?? "caregiver",
      stance: "observation",
    };
  }
  return {
    id: params.id,
    description,
    contributor_id: params.contributorId,
    date: params.date,
    source: params.source ?? "caregiver",
    stance: "observation",
  };
}

export function assertNoDiagnosisInObservation(text: string): void {
  if (DIAGNOSIS_LEAK.test(text)) {
    throw new Error(
      "Behavioral observation layer: diagnosis language must not become Care Reality fact.",
    );
  }
}
