import type { MissingDimension } from "./types";

/** Ambiguity & Structure Validation Layer — pre-reasoning gatekeeper. */

export const AMBIGUITY_VALIDATION_IDENTITY =
  "a deterministic pre-reasoning structure validation gate that blocks downstream LLM reasoning until input dimensions are sufficiently grounded";

export const AMBIGUITY_VALIDATION_ONE_LINE_TRUTH =
  "In SolenOS, structure is never invented — missing dimensions are surfaced, not assumed.";

export const ANTI_STRUCTURE_HALLUCINATION_RULES = [
  "NEVER invent metrics, KPIs, or success criteria not stated by the user",
  "NEVER assume hidden goals, unstated urgency, or implied intent",
  "NEVER default to the most likely interpretation without user confirmation",
  "NEVER populate inferredIntent — intent inference is forbidden",
  "NO STRUCTURE WITHOUT USER CONFIRMATION",
] as const;

export const CLARITY_GATE_FORBIDDEN_ON_AMBIGUOUS = [
  "infer intent",
  "create evaluation criteria",
  "rank priorities",
  "assume urgency or timeframe",
  "proceed with downstream reasoning",
] as const;

export const CARE_DECOMPRESSION_BYPASS_RULE =
  "Caregiving dumps may be structurally incomplete — max clarity downgrade is PARTIAL, never full BLOCK unless input is empty, gibberish, or lacks any care subject.";

export const MIN_SUBSTANTIVE_INPUT_LENGTH = 10;

export const CLARITY_CONSTRAINT_PREFIX = "CLARITY_CONSTRAINT:";

export const MISSING_DIMENSION_QUESTIONS: Record<MissingDimension, string> = {
  TIMEFRAME: "When did this start, or when did you first notice it?",
  SUCCESS_CRITERIA: "What would feel like a useful outcome right now?",
  SCOPE_BOUNDARIES: "Is there one specific part of the situation you want to focus on?",
  SUBJECT_DEFINITION: "Who is this about — name or relationship?",
  STAKEHOLDER_CONTEXT: "Who else is involved (doctor, family, facility, or payer)?",
};
