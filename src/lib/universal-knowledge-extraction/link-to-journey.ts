import { processCareJourneyInput } from "../care-journey-graph/pipeline";
import type { CareJourneyPipelineResult } from "../care-journey-graph/types";
import type { SolenOSDocument } from "../document-intelligence/types";
import type { ExtractedKnowledgeItem } from "./types";

const CATEGORY_TO_DESCRIPTION: Partial<Record<ExtractedKnowledgeItem["category"], string>> = {
  diagnosis: "Diagnosis from document",
  medication: "Medication from document",
  legal_authority: "Legal authority from document",
  decision: "Decision from document",
  appointment: "Appointment from document",
  financial_obligation: "Financial obligation from document",
  responsibility: "Responsibility from document",
  care_instruction: "Care instruction from document",
};

function documentSummaryDescription(
  documentName: string,
  documentType: SolenOSDocument,
  approvedItems: ExtractedKnowledgeItem[],
): string {
  const highlights = approvedItems
    .filter((i) => i.category !== "date" && i.category !== "person")
    .slice(0, 5)
    .map((i) => i.value)
    .join("; ");
  return `Document: ${documentName} (${documentType.replace(/_/g, " ")}). ${highlights || "Structured knowledge extracted."}`;
}

/**
 * Create journey events from approved document knowledge.
 * Low-confidence items are excluded until human review.
 */
export function linkKnowledgeToCareJourney(params: {
  document_id: string;
  document_name: string;
  document_type: SolenOSDocument;
  knowledge_items: ExtractedKnowledgeItem[];
  caregiver_id?: string;
  case_id?: string | null;
  mime_type?: string;
}): { results: CareJourneyPipelineResult[]; updated_items: ExtractedKnowledgeItem[] } {
  const caregiverId = params.caregiver_id ?? "default_caregiver";
  const approved = params.knowledge_items.filter((i) => i.review_status === "approved");
  const results: CareJourneyPipelineResult[] = [];
  const updatedItems = [...params.knowledge_items];

  const summaryResult = processCareJourneyInput({
    description: documentSummaryDescription(params.document_name, params.document_type, approved),
    caregiver_id: caregiverId,
    case_id: params.case_id,
    source: "document",
    attachments: [{ id: params.document_id, name: params.document_name, mime_type: params.mime_type }],
    metadata: {
      knowledge_extraction: true,
      document_type: params.document_type,
      knowledge_item_count: approved.length,
    },
  });
  results.push(summaryResult);

  const priorityCategories: ExtractedKnowledgeItem["category"][] = [
    "diagnosis",
    "medication",
    "legal_authority",
    "decision",
    "appointment",
    "financial_obligation",
  ];

  for (const item of approved) {
    if (!priorityCategories.includes(item.category)) continue;

    const prefix = CATEGORY_TO_DESCRIPTION[item.category] ?? "From document";
    const result = processCareJourneyInput({
      description: `${prefix}: ${item.value}`,
      caregiver_id: caregiverId,
      case_id: params.case_id,
      source: "document",
      attachments: [{ id: params.document_id, name: params.document_name, mime_type: params.mime_type }],
      metadata: {
        knowledge_item_id: item.id,
        knowledge_category: item.category,
        parent_document_event_id: summaryResult.event.id,
        extraction_confidence: item.evidence.extraction_confidence,
      },
    });
    results.push(result);

    const idx = updatedItems.findIndex((u) => u.id === item.id);
    if (idx >= 0) {
      updatedItems[idx] = { ...updatedItems[idx]!, linked_journey_event_id: result.event.id };
    }
  }

  return { results, updated_items: updatedItems };
}
