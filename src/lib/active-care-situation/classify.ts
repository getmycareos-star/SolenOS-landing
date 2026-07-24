import {
  ACTIVE_CARE_SITUATION_HARD_KINDS,
  ACTIVE_CARE_SITUATION_SOFT_KINDS,
  ACTIVE_CARE_SITUATION_WINDOW_MS,
} from "./contract-constants";
import type { CareEventKind } from "../living-care-record-ux/event-clarifiers";
import {
  isCaregiverGuidanceDemand,
  stripCaregiverGuidancePhrases,
} from "../progressive-understanding/clarity-pillars";
import {
  classifyEpistemicClaim,
  frameInterpretationHumanFact,
  frameMissedCareHumanFact,
  isProductSessionMetaText,
  looksLikeCaregiverMissedCareAction,
} from "../care-epistemics";
import { evaluateSituationRelationship } from "../situation-relationship-engine";
import type { ActiveCareSituation, SituationRelation } from "./types";

const EMOTIONAL =
  /\b(frustrat\w*|sad|upset|angry|anxious|anxious|scared|lonely|distressed|agitated|mood|crying|tear\w*|want(?:s|ed)? to go home|go home|homesick)\b/i;

/** @deprecated Prefer resolveSubjectLabel — never infer kinship from note text. */
export { detectSubjectLabel } from "../situation-relationship-engine/signals";

export function isSoftObservationKind(kind: CareEventKind): boolean {
  return (ACTIVE_CARE_SITUATION_SOFT_KINDS as readonly string[]).includes(kind);
}

export function isHardEventKind(kind: CareEventKind): boolean {
  return (ACTIVE_CARE_SITUATION_HARD_KINDS as readonly string[]).includes(kind);
}

export function isEmotionalOrBehavioralText(text: string): boolean {
  return EMOTIONAL.test(text);
}

export function humanFactFromObservation(text: string, subject: string): string {
  const cleaned = text.trim().replace(/^["']+|["']+$/g, "");
  // Pure Continuity Demand — never invent a Dad/Mom "fact" from guidance alone.
  if (isCaregiverGuidanceDemand(cleaned)) return "";
  // Mixed care + guidance: hold the care remainder, drop the ask.
  const stripped = stripCaregiverGuidancePhrases(cleaned);
  const careText = stripped.length >= 8 ? stripped : cleaned;
  // Keep caregiver words — never canned kinship scripts (go home / frustrated / feeling better).
  const who =
    subject === "Mom"
      ? "Your mom"
      : subject === "Dad"
        ? "Your dad"
        : subject && subject !== "Your loved one" && subject !== "they" && subject !== "person"
          ? subject
          : null;
  const clipped = careText.length > 120 ? `${careText.slice(0, 117)}…` : careText;
  if (/^[A-Z]/.test(clipped)) return clipped.endsWith(".") ? clipped : `${clipped}.`;
  if (who) return `${who}: ${clipped}${clipped.endsWith(".") ? "" : "."}`;
  return clipped.endsWith(".") ? clipped : `${clipped}.`;
}

/** Caregiver-facing fact line for an observation. */
export function refineHumanFact(
  text: string,
  subject: string,
  options?: { isFirst?: boolean },
): string {
  void options;
  if (isCaregiverGuidanceDemand(text)) return "";
  const stripped = stripCaregiverGuidancePhrases(text.trim());
  const source = stripped.length >= 8 ? stripped : text;
  // Product / session meta is not a care fact — do not promote into Living Care Record facts.
  if (isProductSessionMetaText(source)) return "";
  if (looksLikeCaregiverMissedCareAction(source)) {
    return frameMissedCareHumanFact(source);
  }
  const epistemic = classifyEpistemicClaim(source);
  if (epistemic === "caregiver_interpretation") {
    return frameInterpretationHumanFact(source, subject);
  }
  // Improvement and mood notes: preserve caregiver words — never invent wellness theater.
  return humanFactFromObservation(source, subject);
}

export function sameCalendarDay(aIso: string, bIso: string): boolean {
  const a = new Date(aIso);
  const b = new Date(bIso);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function withinActiveWindow(updatedAt: string, nowIso: string): boolean {
  const delta = new Date(nowIso).getTime() - new Date(updatedAt).getTime();
  return delta >= 0 && delta <= ACTIVE_CARE_SITUATION_WINDOW_MS;
}

export function subjectsCompatible(a: string, b: string): boolean {
  if (a === b) return true;
  if (a === "Your loved one" || b === "Your loved one" || a === "they" || b === "they") return true;
  return false;
}

/** True when the note itself is a hard-event follow-up (safe to attach to hard ACS). */
export function referencesHardEventInText(text: string): boolean {
  // Intentional hard follow-up only — bare head/hurt/hospital/pill must not glue mood notes.
  return (
    /\bfell\b|\bfall\b|\bfallen\b|\btripped\b|\bslipped\b/i.test(text) ||
    /\bhit\s+(her|his|their)\s+head\b|\bhead\s+injur/i.test(text) ||
    /\burgent\s+care\b|\bdischarg/i.test(text) ||
    /\b(medication|medicine|prescription|dose|pill|pills|rx)\b/i.test(text) ||
    /\bappointment\b|\bfollow[- ]?up\b/i.test(text)
  );
}

/**
 * Server-owned continuity: same situation, or a completely different event?
 * Delegates to Situation Relationship Engine (Product Steward SoT).
 * Client entryIntent is ignored — relation comes from ACS state + content only.
 */
export function classifySituationRelation(params: {
  active: ActiveCareSituation | null;
  rawText: string;
  kind: CareEventKind;
  nowIso: string;
  /**
   * @deprecated Ignored. Relation is server-owned from ACS + content.
   * Kept optional so call sites can drop the arg without a hard break.
   */
  entryIntent?: "initial" | "update";
}): SituationRelation {
  return evaluateSituationRelationship({
    active: params.active,
    rawText: params.rawText,
    kind: params.kind,
    nowIso: params.nowIso,
  }).acs_relation;
}

export function situationThemeFor(
  kind: CareEventKind,
  text: string,
): ActiveCareSituation["theme"] {
  if (isEmotionalOrBehavioralText(text) || kind === "behavior_change") {
    return "emotional_behavior";
  }
  if (kind === "fall" || kind === "hospital_discharge") return "incident";
  if (kind === "medication_change" || kind === "appointment" || kind === "document") {
    return "care_change";
  }
  return "mixed";
}
