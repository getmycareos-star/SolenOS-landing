import { z } from "zod";
import {
  CANONICAL_DOCUMENT_CLARITY_FIELD_ORDER,
  CANONICAL_DOCUMENT_TYPE_TAGS,
  CANONICAL_EXTRACTION_PRIORITIES,
} from "./contract-constants";

export const DOCUMENT_TYPE_TAGS = CANONICAL_DOCUMENT_TYPE_TAGS;
export type DocumentTypeTag = (typeof DOCUMENT_TYPE_TAGS)[number];

export const DocumentTypeTagSchema = z.enum(DOCUMENT_TYPE_TAGS);

export const EXTRACTION_PRIORITIES = CANONICAL_EXTRACTION_PRIORITIES;
export type ExtractionPriority = (typeof EXTRACTION_PRIORITIES)[number];

/** Section 9 — universal document clarity output (canonical document model). */
export const DocumentClarityOutputSchema = z
  .object({
    document_types: z.array(z.string()),
    key_facts: z.array(z.string()),
    action_items: z.array(z.string()),
    deadlines: z.array(z.string()),
    entities: z.array(z.string()),
    uncertainties: z.array(z.string()),
    risk_flags: z.array(z.string()),
  })
  .strict();

export type DocumentClarityOutput = z.infer<typeof DocumentClarityOutputSchema>;

export const DOCUMENT_CLARITY_FIELD_ORDER = CANONICAL_DOCUMENT_CLARITY_FIELD_ORDER;

export const DocumentIntakeOutputSchema = z
  .object({
    document_type_tags: z.array(DocumentTypeTagSchema),
    document_count: z.number().int().min(1),
    preserves_boundaries: z.boolean(),
    extraction_priorities_applied: z.array(z.enum(EXTRACTION_PRIORITIES)),
    is_document_input: z.boolean(),
  })
  .strict();

export type DocumentIntakeOutput = z.infer<typeof DocumentIntakeOutputSchema>;

export type DocumentIntakeViolationCode =
  | "domain_authority_implied"
  | "inferred_institutional_meaning"
  | "eligibility_interpretation"
  | "contradiction_reconciled"
  | "document_boundary_collapsed";

export interface DocumentIntakeValidationResult {
  valid: boolean;
  violations: DocumentIntakeViolationCode[];
}
