import type { DocumentClarityOutput } from "../document-intake/types";
import type { DocumentNode } from "../document-intelligence/types";
import type { ExtractedKnowledgeItem } from "./types";

export function buildDocumentClarityOutput(
  nodes: DocumentNode[],
  knowledgeItems: ExtractedKnowledgeItem[],
): DocumentClarityOutput {
  const document_types = [...new Set(nodes.map((n) => n.type))];

  const key_facts = knowledgeItems
    .filter((i) => i.review_status === "approved" && i.category !== "outstanding_question")
    .map((i) => `${i.label}: ${i.value}`)
    .slice(0, 12);

  const action_items = knowledgeItems
    .filter(
      (i) =>
        i.review_status === "approved" &&
        ["responsibility", "care_instruction", "follow_up_action"].includes(i.category),
    )
    .map((i) => i.value)
    .slice(0, 8);

  const deadlines = knowledgeItems
    .filter((i) => i.category === "deadline" || i.category === "date")
    .map((i) => i.value)
    .slice(0, 8);

  const entities = knowledgeItems
    .filter((i) => i.category === "person" || i.category === "organization")
    .map((i) => i.value)
    .slice(0, 10);

  const uncertainties = knowledgeItems
    .filter((i) => i.category === "outstanding_question" || i.review_status === "pending_review")
    .map((i) => i.value)
    .slice(0, 8);

  const risk_flags = nodes.flatMap((n) =>
    n.inference.ambiguityFlags.filter((f) => /\b(risk|urgent|critical|denied|not covered)\b/i.test(f)),
  ).slice(0, 6);

  return {
    document_types,
    key_facts,
    action_items,
    deadlines,
    entities,
    uncertainties,
    risk_flags,
  };
}
