import type { Classification } from "../schemas";
import type { Classification as ClassType } from "./types";

export type { Classification as ClassificationOutput } from "../schemas";

export interface ClassificationResult {
  type: ClassType;
  confidence: number;
  secondary_tags: ClassType[];
}

const EMERGENCY =
  /\b(911|emergency|unresponsive|can't breathe|unconscious|blue lips|severe bleeding|stroke|heart attack)\b/i;
const CARE_UPDATE =
  /\b(update|changed|symptom|medication|missed|discharge|appointment|watch for|looks worse|getting worse)\b/i;
const EMOTIONAL =
  /\b(overwhelm|scared|exhaust|guilt|anxious|stressed|frustrated|can't cope|terrified|panic)\b/i;
const DOCUMENT = /\b(document|paperwork|form|letter|report|discharge papers|instructions|bill)\b/i;

/** Deterministic classification — no downstream decision authority. */
export function classifyInput(raw: string): ClassificationResult {
  const text = raw.trim();
  const cleaned = text.replace(/\s{2,}/g, " ").trim();

  if (cleaned.length < 3) {
    return { type: "ambiguous", confidence: 0.3, secondary_tags: [] };
  }

  const tags: ClassType[] = [];
  if (EMERGENCY.test(text)) tags.push("emergency");
  if (CARE_UPDATE.test(text)) tags.push("care_update");
  if (EMOTIONAL.test(text)) tags.push("emotional_signal");
  if (text.includes("?")) tags.push("question");
  if (DOCUMENT.test(text)) tags.push("document");

  if (tags.length === 0) {
    if (cleaned.length < 15) {
      return { type: "ambiguous", confidence: 0.35, secondary_tags: [] };
    }
    return { type: "care_update", confidence: 0.55, secondary_tags: [] };
  }

  if (tags.includes("emergency")) {
    return {
      type: "emergency",
      confidence: 0.85,
      secondary_tags: tags.filter((t) => t !== "emergency"),
    };
  }

  if (tags.length === 1) {
    return { type: tags[0], confidence: 0.7, secondary_tags: [] };
  }

  const primary: ClassType = tags.includes("care_update")
    ? "care_update"
    : tags.includes("question")
      ? "question"
      : tags[0];

  return {
    type: primary,
    confidence: 0.6,
    secondary_tags: tags.filter((t) => t !== primary),
  };
}

/** Spec-shaped export for validation. */
export function toClassificationSchema(result: ClassificationResult): Classification {
  return { type: result.type, confidence: result.confidence };
}
