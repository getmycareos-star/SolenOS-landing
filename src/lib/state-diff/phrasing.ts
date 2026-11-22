/**
 * Deterministic wording for already-validated change records.
 *
 * This function only describes a change the diff engine has already produced.
 * It does not decide whether a change occurred or add medical interpretation.
 */

import type { ConfidenceTag } from "../claim-consistency/types";

const CONFIDENCE_PHRASING: Record<ConfidenceTag, string> = {
  confirmed: "was confirmed to",
  reported: "was reported to",
  inferred: "appears to have",
  unknown: "has unknown status for",
  contradictory: "has contradictory information about",
};

export type PhraseChangeInput = {
  field: string;
  previous_value: { value: string; as_of: string } | null;
  new_value: { value: string; as_of: string };
  confidence_tag: ConfidenceTag;
  change_type: "new" | "changed" | "backfilled";
};

/** Deterministic wording; the change record remains the authority. */
export function deterministicPhrase(input: PhraseChangeInput): string {
  const field = input.field.replace(/_/g, " ");
  const confidence = CONFIDENCE_PHRASING[input.confidence_tag] ?? "has unknown status for";

  switch (input.change_type) {
    case "new":
      return `${field} ${confidence} be ${input.new_value.value} as of ${input.new_value.as_of}.`;

    case "changed":
      if (input.previous_value) {
        return `${field} ${confidence} change from ${input.previous_value.value} to ${input.new_value.value} as of ${input.new_value.as_of}.`;
      }
      return `${field} ${confidence} be ${input.new_value.value} as of ${input.new_value.as_of}.`;

    case "backfilled":
      return `Historical record shows ${field} was ${input.new_value.value} as of ${input.new_value.as_of} (backfilled).`;

    default:
      return `${field} updated to ${input.new_value.value}.`;
  }
}
