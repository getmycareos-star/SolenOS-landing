/**
 * Dementia Moment Detection — identifies which of the 5 ranked dementia
 * moments a caregiver input corresponds to.
 *
 * The detection uses structural pattern analysis — not scenario-specific vocabulary.
 * It detects the shape of the caregiver's situation, not the named condition.
 *
 * Detection Principles:
 * - Never diagnose or assert "this is dementia"
 * - Never reference dementia-specific language as trigger
 * - Detect caregiver intent and information structure, not medical content
 */

import type {
  DementiaMomentType,
  DementiaMomentResult,
  DetectedMoment,
} from "./types";
import { MOMENT_CONFIGS } from "./types";

// ─── Signal Pattern Groups ──────────────────────────────────────────────

/**
 * Rank 1: New Behavior Change
 * Signals: change verbs, temporal markers, comparison language, behavior domain
 */
function detectNewBehaviorChange(text: string): { detected: boolean; signal: string } {
  const t = text.toLowerCase().trim();

  // Must have at least one change verb AND one domain or temporal marker
  const hasChangeVerb = /\b(started|stopped|began|became|changed|increased|decreased|worsened|improved|now|different|more\s+than|less\s+than)\b/i.test(t);
  const hasTemporal = /\b(recently|lately|today|yesterday|tonight|this\s+week|this\s+month|past\s+few|last\s+night|last\s+week|since)\b/i.test(t);
  const hasDomain = /\b(?:confus|memory|sleep|tired|eat|eating|appetite|walk|mood|behavior|agitat|wander|anxious|irritable|hallucinat|repeat|question|forget)\b/i.test(t);
  const hasComparison = /\b(?:worse|better|more|less|different|same|usual|normal|before|used\s+to|would\s+usually)\b/i.test(t);
  const hasUncertainty = /\b(?:not\s+sure|wonder|curious|unclear|uncertain|don'?t\s+know\s+if|is\s+this\s+normal)\b/i.test(t);

  if (hasChangeVerb && hasDomain && (hasTemporal || hasComparison)) {
    return { detected: true, signal: "change_verb_with_domain_and_temporal" };
  }
  if (hasChangeVerb && hasUncertainty && hasDomain) {
    return { detected: true, signal: "change_with_uncertainty_about_normalcy" };
  }
  if (hasDomain && hasComparison && hasTemporal) {
    return { detected: true, signal: "domain_comparison_over_time" };
  }

  return { detected: false, signal: "" };
}

/**
 * Rank 2: Doctor Appointment
 * Signals: appointment references, preparation language, summary intent
 */
function detectDoctorAppointment(text: string): { detected: boolean; signal: string } {
  const t = text.toLowerCase().trim();

  const hasAppointmentRef = /\b(?:appointment|doctor|neurologist|specialist|check[-\s]?up|visit|see\s+(?:the\s+)?doctor|clinician|geriatrician)\b/i.test(t);
  const hasPrepIntent = /\b(?:prepare|what\s+to\s+tell|what\s+should\s+i\s+(?:say|ask|mention|bring)|list|summarize|brief|tell\s+the\s+doctor|explain\s+to|questions?\s+for)\b/i.test(t);
  const hasTimeConstraint = /\b(?:only\s+\d+\s+minutes|limited\s+time|short\s+appointment|forget\s+(?:something|to\s+say))\b/i.test(t);
  const hasHistoryIntent = /\b(?:since\s+(?:last|our)|since\s+we\s+(?:last|saw)|what\s+changed|past\s+(?:few|several)\s+(?:weeks?|months?))\b/i.test(t);

  if (hasAppointmentRef && (hasPrepIntent || hasTimeConstraint)) {
    return { detected: true, signal: "appointment_preparation" };
  }
  if (hasAppointmentRef && hasHistoryIntent) {
    return { detected: true, signal: "appointment_history_summary" };
  }

  return { detected: false, signal: "" };
}

/**
 * Rank 3: Hospital Discharge
 * Signals: discharge, hospital, transition words
 */
function detectHospitalDischarge(text: string): { detected: boolean; signal: string } {
  const t = text.toLowerCase().trim();

  const hasDischargeRef = /\b(?:discharg|hospital|admitted|emergency|er|ed|inpatient|released|sent\s+home)\b/i.test(t);
  const hasTransitionIntent = /\b(?:now\s+what|what\s+(?:to\s+)?do|next\s+steps|what\s+changed|follow[-\s]?up|new\s+(?:normal|routine)|came\s+home|got\s+home|brought\s+(?:her|him)\s+home)\b/i.test(t);
  const hasPostEvent = /\b(?:since\s+(?:the\s+)?(?:hospital|stay|admission|discharge|surgery)|after\s+(?:the\s+)?(?:hospital|surgery|procedure))\b/i.test(t);

  if (hasDischargeRef && (hasTransitionIntent || hasPostEvent)) {
    return { detected: true, signal: "hospital_discharge_transition" };
  }
  if (hasDischargeRef && hasPostEvent) {
    return { detected: true, signal: "post_hospital_observation" };
  }

  return { detected: false, signal: "" };
}

/**
 * Rank 4: New Caregiver
 * Signals: onboarding, orientation, handover
 */
function detectNewCaregiver(text: string): { detected: boolean; signal: string } {
  const t = text.toLowerCase().trim();

  const hasNewPerson = /\b(?:new\s+(?:caregiver|nurse|aide|helper|person|worker)|starting|begins?\s+(?:next|today|tomorrow)|hired|will\s+be\s+(?:helping|caring|taking\s+over))\b/i.test(t);
  const hasKnowledgeTransfer = /\b(?:need\s+to\s+(?:tell|explain|show|train|brief)|how\s+do\s+(?:i\s+)?(?:explain|tell)|what\s+should\s+(?:they|he|she)\s+know|important\s+(?:things?|details?)\s+(?:to\s+)?(?:know|share|tell)|need\s+(?:them|someone)\s+to\s+(?:understand|know))\b/i.test(t);
  const hasRoutineContext = /\b(?:routine|schedule|preferenc|like[sd]?|likes?\s+to|usually|normally|typical|daily|habit)\b/i.test(t);

  if (hasNewPerson && (hasKnowledgeTransfer || hasRoutineContext)) {
    return { detected: true, signal: "new_caregiver_knowledge_transfer" };
  }

  return { detected: false, signal: "" };
}

/**
 * Rank 5: Sibling Disagreement
 * Signals: disagreement, different perspectives, conflict
 */
function detectSiblingDisagreement(text: string): { detected: boolean; signal: string } {
  const t = text.toLowerCase().trim();

  const hasDisagreement = /\b(?:doesn'?t\s+(?:think|see|believe|agree)|thinks\s+(?:i'?m|i\s+am)\s+(?:wrong|overreacting|exaggerating|imagining)|says?\s+(?:it'?s\s+)?(?:nothing|normal|fine|not\s+(?:that\s+)?bad)|won'?t\s+(?:listen|believe))\b/i.test(t);
  const hasFamilyRef = /\b(?:sister|brother|sibling|family|relatives?|kids?|children|son|daughter|their\s+(?:father|mother)|his?\s+(?:side|family))\b/i.test(t);
  const hasDifferentView = /\b(?:different\s+(?:view|perspective|opinion|story|version)|don'?t\s+(?:see|understand|get\s+it)|not\s+(?:here|around)\s+(?:every\s+)?day|they\s+don'?t\s+(?:live|see|know))\b/i.test(t);

  if (hasDisagreement && hasFamilyRef) {
    return { detected: true, signal: "family_disagreement_about_care" };
  }
  if (hasFamilyRef && hasDifferentView) {
    return { detected: true, signal: "different_family_perspectives" };
  }

  return { detected: false, signal: "" };
}

// ─── Integration point for existing dementia-entry-extended evaluators ────

/**
 * Maps existing dementia-entry-extended evaluator outputs to DementiaMomentType.
 * This bridges the existing evaluators (evaluateAmbiguousBehaviorShift, etc.)
 * with the new Dementia Moment Detection framework.
 */
export function mapExistingEvaluationToMoment(params: {
  /** Was evaluateSafeChangeVsCrisis triggered? */
  is_change_vs_crisis?: boolean;
  /** Was evaluateGradualChange triggered? */
  is_gradual_change?: boolean;
  /** Was evaluateRoutineDisruption triggered? */
  is_routine_disruption?: boolean;
  /** Was evaluateAmbiguousBehaviorShift triggered? */
  is_ambiguous_shift?: boolean;
  /** Was evaluateNormalcyUncertainty triggered? */
  is_normalcy_uncertainty?: boolean;
  /** Was evaluateCareTransition triggered? */
  is_care_transition?: boolean;
  /** Was evaluateSiblingDisagreement triggered? */
  is_sibling_disagreement?: boolean;
  /** Was evaluateCaregiverRoleTransition triggered? */
  is_role_transition?: boolean;
}): DementiaMomentType {
  if (params.is_change_vs_crisis || params.is_gradual_change || params.is_ambiguous_shift || params.is_normalcy_uncertainty) {
    return "new_behavior_change";
  }
  if (params.is_routine_disruption) {
    return "new_behavior_change";
  }
  if (params.is_care_transition) {
    return "hospital_discharge";
  }
  if (params.is_sibling_disagreement) {
    return "sibling_disagreement";
  }
  if (params.is_role_transition) {
    return "new_caregiver";
  }
  return "unknown";
}

// ─── Main detection function ─────────────────────────────────────────────

/**
 * Detect which dementia moments are present in a caregiver input.
 *
 * Uses structural pattern analysis — not scenario-specific vocabulary.
 * Returns all detected moments sorted by rank (most important first).
 */
export function detectDementiaMoments(text: string): DementiaMomentResult {
  const detections: DetectedMoment[] = [];
  const cleanText = text.trim();

  if (!cleanText) {
    return { detected: [], primary: null, has_moment: false, should_generate_report: false };
  }

  // Detect each moment type
  const r1 = detectNewBehaviorChange(cleanText);
  if (r1.detected) {
    const config = MOMENT_CONFIGS.new_behavior_change;
    detections.push({
      moment: "new_behavior_change",
      confidence: "high",
      trigger_signal: r1.signal,
      rank: config.rank,
      label: config.label,
      solenos_role: config.solenos_role,
      caregiver_emotion: config.caregiver_emotion,
      suggested_orientation: null,
      should_generate_report: config.should_generate_report,
    });
  }

  const r2 = detectDoctorAppointment(cleanText);
  if (r2.detected) {
    const config = MOMENT_CONFIGS.doctor_appointment;
    detections.push({
      moment: "doctor_appointment",
      confidence: "high",
      trigger_signal: r2.signal,
      rank: config.rank,
      label: config.label,
      solenos_role: config.solenos_role,
      caregiver_emotion: config.caregiver_emotion,
      suggested_orientation: "Prepare for the next appointment with a summary of changes since the last visit.",
      should_generate_report: config.should_generate_report,
    });
  }

  const r3 = detectHospitalDischarge(cleanText);
  if (r3.detected) {
    const config = MOMENT_CONFIGS.hospital_discharge;
    detections.push({
      moment: "hospital_discharge",
      confidence: "high",
      trigger_signal: r3.signal,
      rank: config.rank,
      label: config.label,
      solenos_role: config.solenos_role,
      caregiver_emotion: config.caregiver_emotion,
      suggested_orientation: "The transition home is held here — add what has changed since the hospital stay so we can track what matters next.",
      should_generate_report: config.should_generate_report,
    });
  }

  const r4 = detectNewCaregiver(cleanText);
  if (r4.detected) {
    const config = MOMENT_CONFIGS.new_caregiver;
    detections.push({
      moment: "new_caregiver",
      confidence: "high",
      trigger_signal: r4.signal,
      rank: config.rank,
      label: config.label,
      solenos_role: config.solenos_role,
      caregiver_emotion: config.caregiver_emotion,
      suggested_orientation: "A new caregiver is starting — share the routines, preferences, and important details that matter for consistent care.",
      should_generate_report: config.should_generate_report,
    });
  }

  const r5 = detectSiblingDisagreement(cleanText);
  if (r5.detected) {
    const config = MOMENT_CONFIGS.sibling_disagreement;
    detections.push({
      moment: "sibling_disagreement",
      confidence: "high",
      trigger_signal: r5.signal,
      rank: config.rank,
      label: config.label,
      solenos_role: config.solenos_role,
      caregiver_emotion: config.caregiver_emotion,
      suggested_orientation: "Different perspectives on the same situation are normal — capture what you observe so everyone can start from the same understanding.",
      should_generate_report: config.should_generate_report,
    });
  }

  // Sort by rank (ascending — most important first)
  detections.sort((a, b) => a.rank - b.rank);

  // Determine confidence for non-primary moments
  const result = detections.map((d, i) => ({
    ...d,
    confidence: i === 0 ? ("high" as const) : ("medium" as const),
  }));

  return {
    detected: result,
    primary: result[0] ?? null,
    has_moment: result.length > 0,
    should_generate_report: result.some((d) => d.should_generate_report),
  };
}

