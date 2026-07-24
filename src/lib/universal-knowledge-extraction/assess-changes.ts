import type { ExtractedKnowledgeItem, DocumentKnowledgeChanges } from "./types";

export function assessDocumentChanges(
  items: ExtractedKnowledgeItem[],
  documentName: string,
): DocumentKnowledgeChanges {
  const approved = items.filter((i) => i.review_status === "approved");

  const changes: DocumentKnowledgeChanges = {
    summary: [],
    new_diagnoses: [],
    legal_authority_established: [],
    medication_changes: [],
    insurance_decisions: [],
    follow_ups_required: [],
    financial_obligations: [],
    responsibility_changes: [],
    care_plan_updates: [],
  };

  for (const item of approved) {
    switch (item.category) {
      case "diagnosis":
        changes.new_diagnoses.push(item.value);
        changes.summary.push(`New diagnosis recorded from ${documentName}.`);
        break;
      case "legal_authority":
        changes.legal_authority_established.push(item.value);
        changes.summary.push(`Legal authority established — ${item.value.slice(0, 60)}.`);
        break;
      case "medication":
        changes.medication_changes.push(item.value);
        changes.summary.push(`Medication information updated.`);
        break;
      case "decision":
        if (item.domain === "financial") {
          changes.insurance_decisions.push(item.value);
          changes.summary.push(`Insurance or coverage decision recorded.`);
        }
        break;
      case "appointment":
      case "follow_up_action":
        changes.follow_ups_required.push(item.value);
        break;
      case "financial_obligation":
        changes.financial_obligations.push(item.value);
        changes.summary.push(`Financial obligation identified.`);
        break;
      case "responsibility":
        changes.responsibility_changes.push(item.value);
        changes.summary.push(`Responsibility or obligation created.`);
        break;
      case "care_instruction":
        changes.care_plan_updates.push(item.value);
        break;
      default:
        break;
    }
  }

  changes.summary = [...new Set(changes.summary)].slice(0, 8);

  if (changes.summary.length === 0) {
    changes.summary.push(`Document processed: ${documentName}. Knowledge integrated into care journey.`);
  }

  return changes;
}

export function extractFollowUps(items: ExtractedKnowledgeItem[]): string[] {
  return [
    ...new Set(
      items
        .filter(
          (i) =>
            i.review_status === "approved" &&
            ["appointment", "responsibility", "care_instruction", "deadline"].includes(i.category),
        )
        .map((i) => i.value),
    ),
  ].slice(0, 8);
}
