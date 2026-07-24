/**
 * 30-Second Caregiver Understanding Test — midnight gate.
 * Factually correct is not enough; the caregiver must understand better than before.
 *
 * SoT: docs/02-product/solenos-caregiver-understanding-test.md
 * Doc examples are illustrations only — never product if-branches on scenario nouns.
 */

import type { ComposedCaregiverResponse } from "../caregiver-response-composer";
import {
  isSentenceSummaryFailure,
  isTaskGeneratorFailure,
  isGenericSafetyFailure,
  isFamilyDistractionFailure,
  isExcessiveQuestioningFailure,
} from "./intelligence-validation";

export const CAREGIVER_UNDERSTANDING_TEST_PURPOSE =
  "After 30 seconds at midnight, does the caregiver understand the changing care reality more clearly?";

export const MIDNIGHT_GATE_QUESTION =
  "If this caregiver reads this at midnight during a stressful moment, will they understand their situation better than before?";

export type UnderstandingDimension =
  | "understanding"
  | "orientation"
  | "uncertainty_reduction"
  | "priority";

export type UnderstandingTestFailure =
  | "no_improvement"
  | "echo"
  | "task_list"
  | "interview"
  | "family_distraction"
  | "false_reassurance"
  | "false_certainty"
  | "generic_safety";

export type UnderstandingDimensionResult = {
  dimension: UnderstandingDimension;
  improved: boolean;
  evidence: string | null;
};

export type CaregiverUnderstandingTestResult = {
  ok: boolean;
  improves_count: number;
  dimensions: UnderstandingDimensionResult[];
  failures: UnderstandingTestFailure[];
  reason: string | null;
  /** Passes the midnight 30-second question. */
  midnight_pass: boolean;
};

/** False reassurance — never create calm that evidence does not support. */
export const FALSE_REASSURANCE_PATTERNS = [
  /\beverything (?:seems|is|looks) fine\b/i,
  /\bnothing to worry about\b/i,
  /\bno (?:real )?cause for concern\b/i,
  /\bthis is normal\b/i,
  /\byou(?:'re| are) overreacting\b/i,
] as const;

/** Hollow priority placeholders — presence alone is not midnight improvement. */
const HOLLOW_MATTERS_NOW = [
  /^stay with what is already held\.?$/i,
  /^continue observing\.?$/i,
  /^keep watching\.?$/i,
  /^nothing specific yet\.?$/i,
  /^n\/a\.?$/i,
];

function hasMeaningfulUnclear(composed: ComposedCaregiverResponse): boolean {
  return (composed.still_unclear ?? []).some((u) => {
    const t = u.trim();
    return t.length >= 12 && !/^(?:ok|n\/a|none|unclear|unknown)\.?$/i.test(t);
  });
}

function hasMeaningfulMattersNow(composed: ComposedCaregiverResponse): boolean {
  const m = composed.what_matters_now?.trim() ?? "";
  if (m.length < 16) return false;
  if (HOLLOW_MATTERS_NOW.some((p) => p.test(m))) return false;
  return true;
}

function hasMeaningfulChange(composed: ComposedCaregiverResponse): boolean {
  const c = composed.what_changed?.trim() ?? "";
  if (c.length < 12) return false;
  if (/^(?:n\/a|none|unchanged|no change)\.?$/i.test(c)) return false;
  return true;
}

/** False certainty / diagnosis theater. */
export const FALSE_CERTAINTY_PATTERNS = [
  /\bthis is definitely (?:dementia|alzheimer|progression)\b/i,
  /\bdementia is progressing\b/i,
  /\bthis (?:is|means) (?:definitely )?dementia progression\b/i,
  /\bthis looks like (?:dementia )?progression\b/i,
  /\bconsistent with (?:dementia|alzheimer) (?:decline|progression)\b/i,
  /\bthe medication (?:definitely|certainly) caused\b/i,
  /\bwe know (?:for (?:a |certain|sure)|exactly) (?:that )?(?:the )?cause\b/i,
] as const;

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

function normalizeForEcho(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Near-echo of caregiver input — “I already knew that / it repeated what I said.”
 * If orientation dimensions are present, this is not an emotionally useless echo.
 */
export function isCaregiverEchoFailure(params: {
  latestRawText: string;
  responseBlob: string;
}): boolean {
  const oriented =
    improvesUnderstanding(params.responseBlob) ||
    improvesOrientation(params.responseBlob) ||
    improvesUncertaintyReduction(params.responseBlob) ||
    improvesPriority(params.responseBlob);
  if (oriented) return false;

  if (
    isSentenceSummaryFailure({
      latestRawText: params.latestRawText,
      responseBlob: params.responseBlob,
    })
  ) {
    return true;
  }
  const input = normalizeForEcho(params.latestRawText);
  const out = normalizeForEcho(params.responseBlob);
  if (input.length < 24 || out.length < 24) return false;
  if (out.includes(input.slice(0, Math.min(80, input.length)))) return true;
  const inTokens = new Set(input.split(" ").filter((w) => w.length > 3));
  const outTokens = out.split(" ").filter((w) => w.length > 3);
  if (inTokens.size < 4 || outTokens.length < 4) return false;
  const overlap = outTokens.filter((t) => inTokens.has(t)).length;
  const ratio = overlap / Math.max(outTokens.length, 1);
  return ratio >= 0.72;
}

export function improvesUnderstanding(blob: string): boolean {
  return /\b(?:appear(?:s)? (?:to have )?changed|current (?:situation|understanding|concern)|several changes|care reality|what we understand|usual (?:pattern|routine)|previous (?:pattern|routine))\b/i.test(
    blob,
  );
}

export function improvesOrientation(blob: string): boolean {
  return /\b(?:part of a (?:recent )?pattern|rather than an isolated|around the same|fits|connected|related|continuing|recent pattern)\b/i.test(
    blob,
  );
}

export function improvesUncertaintyReduction(blob: string): boolean {
  return /\b(?:unclear|still unclear|what remains|we know|what we know|not (?:yet )?held|whether .{0,40}(?:unclear|unknown|contributed)|cause is (?:still )?unclear)\b/i.test(
    blob,
  );
}

export function improvesPriority(blob: string): boolean {
  return /\b(?:biggest (?:change|concern)|what matters|most important|main (?:change|concern)|primary|safety concern)\b/i.test(
    blob,
  ) || /\b(?:biggest changes right now|the main things to understand)\b/i.test(blob);
}

/**
 * Evaluate the 30-second caregiver understanding test.
 */
export function evaluateCaregiverUnderstandingTest(params: {
  composed: ComposedCaregiverResponse;
  latestRawText: string;
  careRecipient: string | null;
  isRichCareCapture?: boolean;
  hasRecipientChanges?: boolean;
}): CaregiverUnderstandingTestResult {
  const blob = blobFromComposed(params.composed);
  const failures: UnderstandingTestFailure[] = [];
  const rich = params.isRichCareCapture ?? params.latestRawText.length > 80;

  // Orientation in composer fields counts — token overlap with a short soft note
  // must not reject a turn that already names change / priority / uncertainty.
  const structuralOrientation =
    hasMeaningfulChange(params.composed) ||
    hasMeaningfulMattersNow(params.composed) ||
    hasMeaningfulUnclear(params.composed) ||
    Boolean(params.composed.situation_summary?.trim());

  if (
    !structuralOrientation &&
    isCaregiverEchoFailure({ latestRawText: params.latestRawText, responseBlob: blob })
  ) {
    failures.push("echo");
  }
  if (isTaskGeneratorFailure(blob)) {
    failures.push("task_list");
  }
  if (
    isExcessiveQuestioningFailure({
      stillUnclear: params.composed.still_unclear ?? [],
      responseBlob: blob,
    })
  ) {
    failures.push("interview");
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
  if (FALSE_REASSURANCE_PATTERNS.some((p) => p.test(blob))) {
    failures.push("false_reassurance");
  }
  if (FALSE_CERTAINTY_PATTERNS.some((p) => p.test(blob))) {
    failures.push("false_certainty");
  }
  if (
    isGenericSafetyFailure({
      responseBlob: blob,
      latestRawText: params.latestRawText,
    })
  ) {
    failures.push("generic_safety");
  }

  const dimensions: UnderstandingDimensionResult[] = [
    {
      dimension: "understanding",
      improved:
        improvesUnderstanding(blob) ||
        Boolean(params.composed.situation_summary?.trim()) ||
        (params.composed.what_we_know?.length ?? 0) > 0,
      evidence:
        (params.composed.what_we_know?.length ?? 0) > 0 ||
        params.composed.situation_summary
          ? "held situation understanding"
          : improvesUnderstanding(blob)
            ? "situation clarity language"
            : null,
    },
    {
      dimension: "orientation",
      improved: improvesOrientation(blob) || hasMeaningfulChange(params.composed),
      evidence: hasMeaningfulChange(params.composed)
        ? "what changed held"
        : improvesOrientation(blob)
          ? "story/pattern fit language"
          : null,
    },
    {
      dimension: "uncertainty_reduction",
      improved:
        improvesUncertaintyReduction(blob) || hasMeaningfulUnclear(params.composed),
      evidence: hasMeaningfulUnclear(params.composed)
        ? "known vs unclear held"
        : improvesUncertaintyReduction(blob)
          ? "uncertainty language"
          : null,
    },
    {
      dimension: "priority",
      improved: improvesPriority(blob) || hasMeaningfulMattersNow(params.composed),
      evidence: hasMeaningfulMattersNow(params.composed)
        ? "what matters now"
        : improvesPriority(blob)
          ? "priority language"
          : null,
    },
  ];

  const improves_count = dimensions.filter((d) => d.improved).length;
  const minRequired = rich ? 2 : 1;
  if (improves_count < minRequired) {
    failures.push("no_improvement");
  }

  const midnight_pass = failures.length === 0 && improves_count >= minRequired;
  const ok = midnight_pass;

  return {
    ok,
    improves_count,
    dimensions,
    failures: [...new Set(failures)],
    reason: ok
      ? null
      : `30-second understanding test failed: ${[...new Set(failures)].join(", ")} (improved ${improves_count}/${minRequired} required dimensions)`,
    midnight_pass,
  };
}

/**
 * Hard gate — failed output must not reach the caregiver.
 */
export function assertCaregiverUnderstandingTest(params: {
  composed: ComposedCaregiverResponse;
  latestRawText: string;
  careRecipient: string | null;
  isRichCareCapture?: boolean;
  hasRecipientChanges?: boolean;
}): void {
  const result = evaluateCaregiverUnderstandingTest(params);
  if (!result.ok) {
    throw new Error(
      result.reason ??
        "Caregiver understanding test: response rejected — would not improve understanding at midnight",
    );
  }
}

/** Internal reasoning order before caregiver language (MVP spine). */
export const PRE_RESPONSE_REASONING_ORDER = [
  "who",
  "what_changed",
  "baseline",
  "connected_events",
  "known",
  "uncertain",
  "what_matters_most",
  "one_next_understanding_step",
] as const;
