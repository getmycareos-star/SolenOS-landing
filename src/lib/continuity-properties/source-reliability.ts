/**
 * Source Reliability Layer (SRL) — property of CareEvents, not a separate app.
 * Reliability = truth quality of the input. Confidence = system certainty given inputs.
 * These are independent.
 */

export const SOURCE_RELIABILITY_TYPES = [
  "primary_caregiver",
  "secondary_family",
  "professional_caregiver",
  "clinical",
  "sensor_wearable",
  "patient_self_report",
  "system_inference",
  "unverified",
] as const;

export type SourceReliabilityType = (typeof SOURCE_RELIABILITY_TYPES)[number];

/** Baseline reliability scores 0–1 by source type (input quality). */
export const SOURCE_RELIABILITY_BASELINES: Record<SourceReliabilityType, number> = {
  clinical: 0.95,
  professional_caregiver: 0.85,
  primary_caregiver: 0.8,
  sensor_wearable: 0.75,
  secondary_family: 0.55,
  patient_self_report: 0.45,
  system_inference: 0.4,
  unverified: 0.35,
};

export type SourceReliability = {
  source_type: SourceReliabilityType;
  /** 0–1 input truth quality — independent of system confidence. */
  reliability_score: number;
  rationale: string;
};

export function classifySourceReliability(input: {
  source?: "user_input" | "document";
  raw_input?: string;
  attribution_source_type?: string;
  is_inference?: boolean;
}): SourceReliability {
  if (input.is_inference) {
    return {
      source_type: "system_inference",
      reliability_score: SOURCE_RELIABILITY_BASELINES.system_inference,
      rationale: "System-derived interpretation — not a grounded observation.",
    };
  }

  const text = `${input.raw_input ?? ""} ${input.attribution_source_type ?? ""}`.toLowerCase();

  if (
    input.source === "document" ||
    /\b(discharge|physician|doctor|lab|hospital|pharmacy|clinical|diagnosis)\b/i.test(text)
  ) {
    return {
      source_type: "clinical",
      reliability_score: SOURCE_RELIABILITY_BASELINES.clinical,
      rationale: "Clinical / document source — anchors medical facts.",
    };
  }

  if (/\b(nurse|home health|aide|professional caregiver|CNA|RN)\b/i.test(text)) {
    return {
      source_type: "professional_caregiver",
      reliability_score: SOURCE_RELIABILITY_BASELINES.professional_caregiver,
      rationale: "Trained caregiver observation — structured behavioral reliability.",
    };
  }

  if (/\b(sensor|wearable|fitbit|monitor|vitals?)\b/i.test(text)) {
    return {
      source_type: "sensor_wearable",
      reliability_score: SOURCE_RELIABILITY_BASELINES.sensor_wearable,
      rationale: "Objective sensor signal — high for measurement, limited interpretation.",
    };
  }

  if (/\b(brother|sister|sibling|cousin|uncle|aunt|said|told me|someone mentioned)\b/i.test(text)) {
    return {
      source_type: "secondary_family",
      reliability_score: SOURCE_RELIABILITY_BASELINES.secondary_family,
      rationale: "Secondary family report — useful for confirmation, partial context.",
    };
  }

  if (/\b(she said|he said|mom said|dad said|i feel|patient reports)\b/i.test(text)) {
    return {
      source_type: "patient_self_report",
      reliability_score: SOURCE_RELIABILITY_BASELINES.patient_self_report,
      rationale: "Care recipient self-report — variable under cognitive impairment.",
    };
  }

  return {
    source_type: "primary_caregiver",
    reliability_score: SOURCE_RELIABILITY_BASELINES.primary_caregiver,
    rationale: "Primary caregiver direct observation — high contextual accuracy.",
  };
}

/**
 * When sources conflict: do not average blindly.
 * Prefer higher reliability; keep lower as contradiction evidence.
 */
export function resolveReliabilityConflict(a: SourceReliability, b: SourceReliability): {
  preferred: SourceReliability;
  subordinate: SourceReliability;
  must_record_contradiction: true;
  lower_global_confidence: true;
} {
  const preferred = a.reliability_score >= b.reliability_score ? a : b;
  const subordinate = preferred === a ? b : a;
  return {
    preferred,
    subordinate,
    must_record_contradiction: true,
    lower_global_confidence: true,
  };
}
