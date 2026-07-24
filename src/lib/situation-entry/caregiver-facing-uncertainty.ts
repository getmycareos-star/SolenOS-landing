/**
 * Caregiver-facing uncertainty boundary.
 * Internal DARE reasons / schema fields never enter SituationResponse DTOs.
 */

import {
  dedupeCaregiverFacingLines,
  isBareSchemaField,
  isCaregiverSafeDisplayText,
  sanitizeCaregiverDisplayText,
  toCaregiverFacingLine,
} from "../mvp-input-architecture";
import { isCaregiverFacingAsk } from "../progressive-understanding/questions";

/** Tokens banned on caregiver-facing response DTOs (verify + runtime). */
export const CAREGIVER_RESPONSE_BANNED_TOKENS = [
  "ambiguous_extraction",
  "partial_extraction",
  "partial_signal",
  "partial signal",
  "low_confidence",
  "provisional:",
  "freshness window",
  "observation signal",
  "extraction_status",
  "parser_output",
  "can you clarify: entity",
  "can you clarify: time",
  "can you clarify: severity",
  "can you clarify: consequence",
] as const;

export function caregiverLineContainsBannedToken(text: string): boolean {
  const lower = text.toLowerCase();
  return CAREGIVER_RESPONSE_BANNED_TOKENS.some((t) => lower.includes(t));
}

/**
 * Map a DARE uncertain candidate to a calm caregiver line — never "Provisional: … (reason)".
 */
export function caregiverLineFromDareUncertain(u: {
  label: string;
  reason?: string;
  missing_fields?: string[];
}): string | null {
  for (const field of u.missing_fields ?? []) {
    const fromField = toCaregiverFacingLine(field);
    if (fromField) return fromField;
    if (isBareSchemaField(field)) {
      const humanized = toCaregiverFacingLine(`Can you clarify: ${field}?`);
      if (humanized) return humanized;
    }
  }

  const fromProvisionalForm = toCaregiverFacingLine(`Provisional: ${u.label}`);
  if (fromProvisionalForm && !caregiverLineContainsBannedToken(fromProvisionalForm)) {
    return fromProvisionalForm;
  }

  const cleaned = sanitizeCaregiverDisplayText(u.label);
  if (
    cleaned &&
    isCaregiverSafeDisplayText(cleaned) &&
    !isBareSchemaField(cleaned) &&
    !caregiverLineContainsBannedToken(cleaned)
  ) {
    return cleaned.endsWith(".") ? cleaned : `Still confirming: ${cleaned}`;
  }

  return "Still confirming details from your note";
}

export function caregiverLineFromUnreadableSection(reason: string): string {
  if (reason === "low_ocr_confidence") {
    return "Part of a document was hard to read — a clearer photo or typed note would help.";
  }
  if (reason === "extraction_failed") {
    return "Some document text could not be read clearly.";
  }
  if (reason === "empty_content") {
    return "A document section had little readable text.";
  }
  return "A document section needs a clearer copy.";
}

/** Sanitize any uncertainty / clarification string list for caregiver DTOs. */
export function sanitizeCaregiverFacingLines(
  lines: readonly string[],
  max = 12,
  opts?: { asksOnly?: boolean },
): string[] {
  const out: string[] = [];
  for (const raw of lines) {
    const line = toCaregiverFacingLine(raw);
    if (!line) continue;
    if (caregiverLineContainsBannedToken(line)) continue;
    if (isBareSchemaField(line)) continue;
    if (opts?.asksOnly && !isCaregiverFacingAsk(line)) continue;
    out.push(line);
  }
  return dedupeCaregiverFacingLines(out, max);
}

export type CaregiverFacingUncertaintyFields = {
  what_is_uncertain: string[];
  what_needs_clarification: string[];
  continuous_execution_loop_layer?: {
    open_uncertainties?: string[];
    [key: string]: unknown;
  } | null;
};

/** Final choke point before SituationResponse leaves the pipeline. */
export function sanitizeSituationUncertaintyFields<T extends CaregiverFacingUncertaintyFields>(
  response: T,
): T {
  const what_is_uncertain = sanitizeCaregiverFacingLines(response.what_is_uncertain ?? [], 8);
  const what_needs_clarification = sanitizeCaregiverFacingLines(
    response.what_needs_clarification ?? [],
    6,
    { asksOnly: true },
  );

  let continuous_execution_loop_layer = response.continuous_execution_loop_layer;
  if (continuous_execution_loop_layer) {
    continuous_execution_loop_layer = {
      ...continuous_execution_loop_layer,
      open_uncertainties: sanitizeCaregiverFacingLines(
        continuous_execution_loop_layer.open_uncertainties ?? [],
      ),
    };
  }

  return {
    ...response,
    what_is_uncertain,
    what_needs_clarification,
    continuous_execution_loop_layer,
  };
}
