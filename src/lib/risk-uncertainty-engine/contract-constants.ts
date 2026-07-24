/** Risk & Uncertainty Engine — mandatory system rule for situation analysis. */

export const RISK_UNCERTAINTY_IDENTITY =
  "Mandatory gate — never infer urgency or safety from incomplete information.";

export const RISK_UNCERTAINTY_BOUNDARY =
  "Missing information blocks priority assignment. Absence of data is not a signal of safety.";

export const COMPLETENESS_STATUSES = [
  "COMPLETE",
  "PARTIALLY_COMPLETE",
  "INSUFFICIENT",
] as const;

export const CONFIDENCE_LEVELS = [
  "High",
  "Medium",
  "Low",
  "Insufficient Information",
] as const;

export const PRIORITY_ASSESSMENTS = [
  "High Priority",
  "Moderate Priority",
  "Low Priority",
  "Unable to Determine",
] as const;

export const FORBIDDEN_REASSURANCE_PATTERNS = [
  /\bmonitor (and|&) observe\b/i,
  /\bno need to worry\b/i,
  /\brest and (see|monitor)\b/i,
  /\bprobably fine\b/i,
  /\bshould be okay\b/i,
  /\blow risk\b/i,
  /\bnot urgent\b/i,
] as const;

export const PROHIBITED_WHEN_INSUFFICIENT = [
  "assign priority",
  "assign urgency",
  "suggest outcomes",
  "give reassurance framing",
  "label Low Priority",
  "assume recovery or stability",
  "fill missing context with plausible scenarios",
] as const;
