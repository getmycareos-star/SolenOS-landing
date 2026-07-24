import type { Classification, DomainTag, SignalVector } from "./types";

export interface DomainTagResult {
  primary: DomainTag;
  secondary: DomainTag[];
}

/**
 * Step 3: Domain Tagging — ONE primary domain only.
 * Domains route context; they do NOT make decisions.
 */
export function tagDomain(
  classification: Classification,
  signals: SignalVector,
  raw: string,
): DomainTagResult {
  const secondary: DomainTag[] = [];
  let primary: DomainTag = "medical";

  if (classification === "emergency") {
    primary = "emergency-care";
  } else if (/\b(discharge|came home from hospital|post.?op|after surgery)\b/i.test(raw)) {
    primary = "post-care";
  } else if (/\b(dementia|alzheimer|chronic|daily|routine|long.?term)\b/i.test(raw)) {
    primary = "chronic-care";
  } else if (
    classification === "document" ||
    /\b(insurance|medicare|medicaid|bill|legal|coverage|claim)\b/i.test(raw)
  ) {
    primary = "administrative-care";
  } else if (signals.medical_entities.length > 0 || signals.urgency_signals.length > 0) {
    primary = "medical";
  } else if (classification === "emotional_signal") {
    primary = "medical";
    secondary.push("chronic-care");
  }

  if (signals.inferred.some((i) => i.signal === "care transition") && primary !== "post-care") {
    secondary.push("post-care");
  }
  if (signals.emotional_intensity >= 0.5 && primary !== "chronic-care") {
    secondary.push("chronic-care");
  }

  return {
    primary,
    secondary: [...new Set(secondary.filter((d) => d !== primary))],
  };
}
