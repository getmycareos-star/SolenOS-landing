/**
 * Hard Rejection & Intelligence Validation Layer.
 * Rejects outputs that look smart but do not improve care-reality understanding.
 *
 * SoT: docs/02-product/solenos-intelligence-validation.md
 * Doc examples are illustrations only — never product if-branches on scenario nouns.
 */

import type { ComposedCaregiverResponse } from "../caregiver-response-composer";
import { centersContributorConflictOverRecipient } from "./care-recipient-anchor";
import { containsSituationSummaryTheater } from "./situation-generator";
import { containsTextMemoryTheater } from "./care-reality-memory";
import { containsCausalTheater } from "./uncertainty-preservation";

export const INTELLIGENCE_VALIDATION_PURPOSE =
  "Reject responses that summarize, task-ify, or distract — require orientation that improves understanding of changing care reality.";

export type IntelligenceFailureMode =
  | "sentence_summary"
  | "task_generator"
  | "generic_safety"
  | "family_distraction"
  | "excessive_questioning"
  | "checklist_incomplete"
  | "causal_theater";

export type IntelligenceChecklistItem = {
  id: string;
  label: string;
  passed: boolean;
  critical: boolean;
};

export type IntelligenceValidationResult = {
  ok: boolean;
  failures: IntelligenceFailureMode[];
  checklist: IntelligenceChecklistItem[];
  reason: string | null;
};

/** Failure 2 — task / monitor theater. */
export const HARD_REJECTION_TASK_PATTERNS = [
  /\bhere are your tasks\b/i,
  /\bthings to do\b/i,
  /\bto-?do list\b/i,
  /\baction items?:/i,
  /\b☐|\b\[\s*\]/u,
  /\bmonitor (?:symptoms|eating|sleep|confusion)\b/i,
  /\bcall (?:the )?doctor\b/i,
  /\bcheck medication\b/i,
  /\bwatch eating\b/i,
  /\btrack sleep\b/i,
  /\bcare checklist\b/i,
] as const;

/** Failure 3 — generic safety without care-reality context. */
export const HARD_REJECTION_GENERIC_SAFETY_PATTERNS = [
  /\bconfusion and falls can be serious\b/i,
  /\bplease contact (?:a |your )?healthcare provider\b/i,
  /\bseek (?:immediate )?medical attention\b/i,
  /\bthis (?:can be|may be) (?:a )?medical emergency\b/i,
  /\bconsult (?:your )?doctor (?:immediately|right away)\b/i,
] as const;

/** Failure 4 — family disagreement centered. */
export const HARD_REJECTION_FAMILY_DISTRACTION_PATTERNS = [
  /\byour brother may (?:need to|not) understand\b/i,
  /\byour sister (?:may|needs to) understand\b/i,
  /\bfamily (?:needs to|should) (?:understand|agree)\b/i,
  /\bthe (?:main|biggest) (?:issue|problem) is (?:your )?(?:brother|sister|family)\b/i,
] as const;

/** Understanding signals — orientation language, not bare “medication change”. */
const UNDERSTANDING_SIGNALS =
  /\b(?:appear(?:s)? (?:to have )?changed|what changed|has changed|usual (?:pattern|)|previous (?:pattern|routine|)|baseline|connect(?:ed|ion|s)?|may (?:be )?related|around the same|still unclear|remains unclear|reason remains unclear|what remains unclear|possible(?: connection| relationship| factors)?|care reality|current understanding|what we (?:know|understand)|several (?:care )?concerns|care concerns|held from what you shared|organized so they stay connected|what was (?:usual|normal) before|Held so far)\b/i;

function blobFromComposed(composed: ComposedCaregiverResponse): string {
  return [
    composed.recognition_line ?? "",
    composed.confirmation,
    composed.situation_summary ?? "",
    ...(composed.what_we_know ?? []),
    composed.connection_note ?? "",
    composed.what_changed ?? "",
    composed.what_matters_now ?? "",
    ...(composed.still_unclear ?? []),
    composed.care_story_update ?? "",
  ].join("\n");
}

/** Structural care facets from input — not clinical keyword product banks. */
function extractInputFacets(text: string): string[] {
  const t = text.toLowerCase();
  const facets: string[] = [];
  const cues: Array<{ id: string; re: RegExp }> = [
    { id: "confused", re: /\bconfused|confusion\b/ },
    { id: "leave_home", re: /\bleav(?:e|ing) (?:the )?(?:house|home)|tried leaving\b/ },
    { id: "eating", re: /\beating|eat(?:s|ing)?|appetite\b/ },
    { id: "sleep", re: /\bsleep(?:ing)?|tired\b/ },
    { id: "fall", re: /\bfall|fell|fall scare\b/ },
    { id: "medication", re: /\bmedication|medicine\b/ },
    { id: "hospital", re: /\bhospital|discharg\b/ },
  ];
  for (const c of cues) {
    if (c.re.test(t)) facets.push(c.id);
  }
  return facets;
}

/**
 * Failure 1: response mostly restates input facets without understanding language.
 */
export function isSentenceSummaryFailure(params: {
  latestRawText: string;
  responseBlob: string;
}): boolean {
  const facets = extractInputFacets(params.latestRawText);
  if (facets.length < 3) return false;

  const blob = params.responseBlob.toLowerCase();
  const facetHits = facets.filter((f) => {
    if (f === "leave_home") return /leav|house|home/i.test(blob);
    if (f === "fall") return /fall|fell/i.test(blob);
    return blob.includes(f.replace("_", " ")) || new RegExp(f, "i").test(blob);
  }).length;

  const restatesMost = facetHits >= Math.min(4, facets.length);
  const hasUnderstanding = UNDERSTANDING_SIGNALS.test(params.responseBlob);

  // Comma-list echo of the whole message (classic summary failure)
  const listEcho =
    /(?:confused|confusion).{0,80}(?:leav|house).{0,80}(?:eat|sleep).{0,80}(?:fall|medication)/i.test(
      params.responseBlob,
    ) && !hasUnderstanding;

  return (restatesMost && !hasUnderstanding) || listEcho;
}

export function isTaskGeneratorFailure(blob: string): boolean {
  return HARD_REJECTION_TASK_PATTERNS.some((p) => p.test(blob));
}

export function isGenericSafetyFailure(params: {
  responseBlob: string;
  latestRawText: string;
}): boolean {
  if (!HARD_REJECTION_GENERIC_SAFETY_PATTERNS.some((p) => p.test(params.responseBlob))) {
    return false;
  }
  // Generic safety without timing / baseline / uncertainty / connection → fail
  const hasContext =
    UNDERSTANDING_SIGNALS.test(params.responseBlob) ||
    /\b(?:usual|previous|since|after|around|unclear|unknown)\b/i.test(params.responseBlob);
  return !hasContext;
}

export function isFamilyDistractionFailure(params: {
  responseBlob: string;
  careRecipient: string | null;
  hasRecipientChanges: boolean;
}): boolean {
  if (HARD_REJECTION_FAMILY_DISTRACTION_PATTERNS.some((p) => p.test(params.responseBlob))) {
    return true;
  }
  return centersContributorConflictOverRecipient({
    blob: params.responseBlob,
    careRecipient: params.careRecipient,
    hasRecipientChanges: params.hasRecipientChanges,
  });
}

export function isExcessiveQuestioningFailure(params: {
  stillUnclear: string[];
  responseBlob: string;
}): boolean {
  if (params.stillUnclear.length > 3) return true;
  // Interview battery in a single blob
  const qMarks = (params.responseBlob.match(/\?/g) ?? []).length;
  if (qMarks >= 4) return true;
  const interviewCues =
    /\bhow old\b.+\bwhat medication\b.+\bwhat dosage\b|\bwhen did this start\b.+\bhow often\b.+\bwhat dosage\b/i;
  return interviewCues.test(params.responseBlob);
}

/**
 * Midnight caregiver checklist — critical items must pass for multi-facet care captures.
 */
export function buildIntelligenceChecklist(params: {
  careRecipientIdentified: boolean;
  hasBaselineOrInitialAssessment: boolean;
  identifiedChange: boolean;
  connectedRelatedEvents: boolean;
  preservedUncertainty: boolean;
  avoidedInventedCause: boolean;
  reducedConfusion: boolean;
  avoidedUnnecessaryWork: boolean;
  helpsAtMidnight: boolean;
}): IntelligenceChecklistItem[] {
  return [
    {
      id: "who",
      label: "Identified who this care story is about",
      passed: params.careRecipientIdentified,
      critical: true,
    },
    {
      id: "baseline",
      label: "Compared against baseline or used initial assessment",
      passed: params.hasBaselineOrInitialAssessment,
      critical: true,
    },
    {
      id: "changed",
      label: "Identified what changed",
      passed: params.identifiedChange,
      critical: true,
    },
    {
      id: "connected",
      label: "Connected related events (possible, not proven)",
      passed: params.connectedRelatedEvents,
      critical: false,
    },
    {
      id: "uncertainty",
      label: "Preserved uncertainty",
      passed: params.preservedUncertainty,
      critical: true,
    },
    {
      id: "cause",
      label: "Avoided pretending to know the cause",
      passed: params.avoidedInventedCause,
      critical: true,
    },
    {
      id: "clarity",
      label: "Reduced confusion",
      passed: params.reducedConfusion,
      critical: true,
    },
    {
      id: "work",
      label: "Avoided creating unnecessary work",
      passed: params.avoidedUnnecessaryWork,
      critical: true,
    },
    {
      id: "midnight",
      label: "Would help a caregiver at midnight",
      passed: params.helpsAtMidnight,
      critical: true,
    },
  ];
}

/**
 * Run hard rejection + checklist. Returns ok=false when caregiver must not see this output.
 */
export function validateIntelligenceResponse(params: {
  composed: ComposedCaregiverResponse;
  latestRawText: string;
  careRecipient: string | null;
  /** Multi-facet capture — enforce richer checklist. */
  isRichCareCapture?: boolean;
  hasComparablePrior?: boolean;
  isInitialAssessment?: boolean;
  hasRecipientChanges?: boolean;
}): IntelligenceValidationResult {
  const blob = blobFromComposed(params.composed);
  const failures: IntelligenceFailureMode[] = [];

  if (isSentenceSummaryFailure({ latestRawText: params.latestRawText, responseBlob: blob })) {
    failures.push("sentence_summary");
  }
  if (isTaskGeneratorFailure(blob)) {
    failures.push("task_generator");
  }
  if (
    isGenericSafetyFailure({
      responseBlob: blob,
      latestRawText: params.latestRawText,
    })
  ) {
    failures.push("generic_safety");
  }
  if (
    isFamilyDistractionFailure({
      responseBlob: blob,
      careRecipient: params.careRecipient,
      hasRecipientChanges: params.hasRecipientChanges ?? true,
    })
  ) {
    failures.push("family_distraction");
  }
  if (
    isExcessiveQuestioningFailure({
      stillUnclear: params.composed.still_unclear ?? [],
      responseBlob: blob,
    })
  ) {
    failures.push("excessive_questioning");
  }
  if (containsSituationSummaryTheater(blob) || containsTextMemoryTheater(blob)) {
    if (!failures.includes("sentence_summary")) failures.push("sentence_summary");
  }
  if (containsCausalTheater(blob)) {
    failures.push("causal_theater");
  }

  const rich = params.isRichCareCapture ?? extractInputFacets(params.latestRawText).length >= 3;
  const hasUnderstanding = UNDERSTANDING_SIGNALS.test(blob);
  const hasUnknown =
    (params.composed.still_unclear?.length ?? 0) > 0 ||
    /\b(?:unclear|not (?:yet )?held|unknown|whether)\b/i.test(blob);
  const hasChange =
    Boolean(params.composed.what_changed?.trim()) ||
    /\b(?:changed|change|different|usual|previous)\b/i.test(blob);
  const hasConnection =
    Boolean(params.composed.connection_note?.trim()) ||
    /\b(?:related|connect|around the same|may (?:be )?related)\b/i.test(blob);
  const inventedCause =
    containsCausalTheater(blob) ||
    /\b(?:caused by|because of the dementia|medication caused)\b/i.test(blob);

  const checklist = buildIntelligenceChecklist({
    // Named identity preferred; pronoun-centered recipient changes also count (Locked A —
    // display name may not be set yet while the story is clearly about the person).
    careRecipientIdentified:
      Boolean(params.careRecipient && params.careRecipient !== "they") ||
      Boolean(params.hasRecipientChanges),
    hasBaselineOrInitialAssessment:
      Boolean(params.hasComparablePrior) ||
      Boolean(params.isInitialAssessment) ||
      !rich,
    identifiedChange: !rich || hasChange || hasUnderstanding,
    connectedRelatedEvents: !rich || hasConnection || hasUnderstanding,
    preservedUncertainty: !rich || hasUnknown || (params.composed.still_unclear?.length ?? 0) <= 3,
    avoidedInventedCause: !inventedCause,
    reducedConfusion: hasUnderstanding || !rich,
    avoidedUnnecessaryWork: !isTaskGeneratorFailure(blob),
    helpsAtMidnight:
      hasUnderstanding &&
      !isTaskGeneratorFailure(blob) &&
      !isExcessiveQuestioningFailure({
        stillUnclear: params.composed.still_unclear ?? [],
        responseBlob: blob,
      }),
  });

  const criticalFail = checklist.some((c) => c.critical && !c.passed);
  if (criticalFail && rich) {
    failures.push("checklist_incomplete");
  }

  const ok = failures.length === 0;
  let reason: string | null = null;
  if (!ok) {
    reason = `Intelligence validation failed: ${failures.join(", ")}`;
  }

  return { ok, failures, checklist, reason };
}

/**
 * Hard gate — throw so failed output never reaches the caregiver.
 */
export function assertIntelligenceValidation(params: {
  composed: ComposedCaregiverResponse;
  latestRawText: string;
  careRecipient: string | null;
  isRichCareCapture?: boolean;
  hasComparablePrior?: boolean;
  isInitialAssessment?: boolean;
  hasRecipientChanges?: boolean;
}): void {
  const result = validateIntelligenceResponse(params);
  if (!result.ok) {
    throw new Error(
      result.reason ?? "Intelligence validation: response rejected — does not improve care-reality understanding",
    );
  }
}

/** Gate question — documentation / tests. */
export const INTELLIGENCE_GATE_QUESTION =
  "Does this response help the caregiver understand the changing care reality better?";
