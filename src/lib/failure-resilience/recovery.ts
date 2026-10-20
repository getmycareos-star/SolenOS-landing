import type { FailureRecord } from "./types";

export const RECOVERY_ACTIONS = [
  "edit_extracted_facts",
  "confirm_uncertain_information",
  "reject_incorrect_extraction",
  "add_missing_details",
  "retry_processing",
  "defer_for_later",
  "resolve_relationship",
  "resolve_conflict",
] as const;

export type RecoveryAction = (typeof RECOVERY_ACTIONS)[number];

export function deriveRecoveryActions(failures: FailureRecord[]): RecoveryAction[] {
  const actions = new Set<RecoveryAction>();

  for (const f of failures) {
    switch (f.category) {
      case "extraction_failure":
        actions.add("edit_extracted_facts");
        actions.add("reject_incorrect_extraction");
        actions.add("retry_processing");
        actions.add("add_missing_details");
        break;
      case "incomplete_context":
        actions.add("add_missing_details");
        actions.add("confirm_uncertain_information");
        actions.add("defer_for_later");
        break;
      case "ambiguous_interpretation":
        actions.add("confirm_uncertain_information");
        actions.add("defer_for_later");
        break;
      case "graph_linking_failure":
        actions.add("resolve_relationship");
        actions.add("add_missing_details");
        actions.add("defer_for_later");
        break;
      case "conflicting_information":
        actions.add("resolve_conflict");
        actions.add("confirm_uncertain_information");
        break;
      case "processing_failure":
        actions.add("retry_processing");
        actions.add("defer_for_later");
        break;
    }
  }

  if (actions.size === 0) {
    actions.add("edit_extracted_facts");
    actions.add("add_missing_details");
  }

  return [...actions];
}

export function recoveryActionLabel(action: RecoveryAction): string {
  const labels: Record<RecoveryAction, string> = {
    edit_extracted_facts: "Edit extracted facts",
    confirm_uncertain_information: "Confirm uncertain information",
    reject_incorrect_extraction: "Reject incorrect extraction",
    add_missing_details: "Add missing details",
    retry_processing: "Retry processing",
    defer_for_later: "Leave unresolved for later",
    resolve_relationship: "Clarify relationship",
    resolve_conflict: "Resolve conflict",
  };
  return labels[action];
}
