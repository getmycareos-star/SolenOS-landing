import {
  ProfessionalSummary,
  ProfessionalSummaryCorrection,
  ProfessionalSummaryApproval,
  ProfessionalSummarySharing,
  ProfessionalSummaryResponse,
  ProfessionalSummaryAuditEntry,
  ProfessionalSummaryStatus,
} from "@/lib/entities/types";
import {
  createProfessionalSummary,
  getProfessionalSummary,
  updateProfessionalSummary,
  deleteProfessionalSummary,
  listProfessionalSummaries,
  addProfessionalSummaryCorrection,
  approveProfessionalSummary,
  shareProfessionalSummary,
  recordProfessionalSummaryResponse,
  openProfessionalSummary,
  supersedeProfessionalSummary,
  resetEntityStore,
} from "@/lib/entities/store";

/**
 * Professional Summary Manager
 * 
 * Manages the lifecycle of Professional Summaries including creation,
 * review, correction, approval, sharing, and professional response handling.
 * Follows the same pattern as other managers in the codebase (e.g., consent-manager).
 */

/**
 * Create a new professional summary in DRAFT status
 */
export function createProfessionalSummaryManager(params: {
  care_recipient_id: string;
  authoring_caregiver_id: string;
  intended_professional_id?: string | null;
  purpose_context?: string | null;
  care_context_version: string;
  source_evidence_references: string[];
  generated_content: string;
  created_by: string;
}): ProfessionalSummary {
  return createProfessionalSummary({
    care_recipient_id: params.care_recipient_id,
    authoring_caregiver_id: params.authoring_caregiver_id,
    intended_professional_id: params.intended_professional_id,
    purpose_context: params.purpose_context,
    care_context_version: params.care_context_version,
    source_evidence_references: params.source_evidence_references,
    generated_content: params.generated_content,
    created_by: params.created_by,
  });
}

/**
 * Get a professional summary by ID
 */
export function getProfessionalSummaryManager(id: string): ProfessionalSummary | null {
  return getProfessionalSummary(id);
}

/**
 * List all professional summaries (for admin/caregiver overview)
 */
export function listProfessionalSummariesManager(): ProfessionalSummary[] {
  return listProfessionalSummaries();
}

/**
 * Update a professional summary (e.g., when generating content)
 */
export function updateProfessionalSummaryManager(id: string, updates: Partial<ProfessionalSummary>, updatedBy: string): ProfessionalSummary | null {
  return updateProfessionalSummary(id, { ...updates, updated_by: updatedBy });
}

/**
 * Add a correction to a professional summary
 */
export function addProfessionalSummaryCorrectionManager(params: {
  professional_summary_id: string;
  field: string;
  original_content: string;
  corrected_content: string;
  correcting_caregiver_id: string;
  reason?: string | null;
  source_evidence_references?: string[];
}): ProfessionalSummaryCorrection | null {
  return addProfessionalSummaryCorrection({
    professional_summary_id: params.professional_summary_id,
    field: params.field,
    original_content: params.original_content,
    corrected_content: params.corrected_content,
    correcting_caregiver_id: params.correcting_caregiver_id,
    reason: params.reason,
    source_evidence_references: params.source_evidence_references,
  });
}

/**
 * Approve a professional summary (changes status to APPROVED)
 */
export function approveProfessionalSummaryManager(params: {
  professional_summary_id: string;
  approving_caregiver_id: string;
}): ProfessionalSummaryApproval | null {
  return approveProfessionalSummary({
    professional_summary_id: params.professional_summary_id,
    approving_caregiver_id: params.approving_caregiver_id,
  });
}

/**
 * Share a professional summary with a professional (requires APPROVED status)
 */
export function shareProfessionalSummaryManager(params: {
  professional_summary_id: string;
  shared_by: string;
  shared_with_professional_id: string;
}): ProfessionalSummarySharing | null {
  return shareProfessionalSummary({
    professional_summary_id: params.professional_summary_id,
    shared_by: params.shared_by,
    shared_with_professional_id: params.shared_with_professional_id,
  });
}

/**
 * Record a professional's response to a shared summary
 */
export function recordProfessionalSummaryResponseManager(params: {
  professional_summary_id: string;
  responding_professional_id: string;
  response_text: string;
  response_type: "clarification" | "comment" | "recommendation" | "decision" | "follow_up_request" | "additional_information" | "acknowledgment";
  is_decision?: boolean;
  decision_text?: string | null;
}): ProfessionalSummaryResponse | null {
  return recordProfessionalSummaryResponse({
    professional_summary_id: params.professional_summary_id,
    responding_professional_id: params.responding_professional_id,
    response_text: params.response_text,
    response_type: params.response_type,
    is_decision: params.is_decision,
    decision_text: params.decision_text,
  });
}

/**
 * Mark a shared summary as opened by a professional
 */
export function openProfessionalSummaryManager(params: {
  professional_summary_id: string;
  opened_by: string; // The professional who opened it
}): ProfessionalSummary | null {
  return openProfessionalSummary({
    professional_summary_id: params.professional_summary_id,
    opened_by: params.opened_by,
  });
}

/**
 * Supersede a professional summary (when a newer version is created)
 */
export function supersedeProfessionalSummaryManager(params: {
  professional_summary_id: string;
  superseded_by: string; // The caregiver who superseded it (usually by creating a new one)
}): ProfessionalSummary | null {
  return supersedeProfessionalSummary({
    professional_summary_id: params.professional_summary_id,
    superseded_by: params.superseded_by,
  });
}

/**
 * Get the audit trail for a professional summary
 */
export function getProfessionalSummaryAuditTrail(professionalSummaryId: string): ProfessionalSummaryAuditEntry[] {
  const summary = getProfessionalSummary(professionalSummaryId);
  if (!summary) return [];
  return summary.audit_trail;
}

/**
 * Get corrections for a professional summary
 */
export function getProfessionalSummaryCorrections(professionalSummaryId: string): ProfessionalSummaryCorrection[] {
  const summary = getProfessionalSummary(professionalSummaryId);
  if (!summary) return [];
  return summary.caregiver_corrections;
}

/**
 * Check if a professional summary can be shared (must be APPROVED)
 */
export function canShareProfessionalSummary(professionalSummaryId: string): boolean {
  const summary = getProfessionalSummary(professionalSummaryId);
  if (!summary) return false;
  return summary.status === "APPROVED";
}

/**
 * Check if a professional summary has been opened by a professional
 */
export function isProfessionalSummaryOpened(professionalSummaryId: string): boolean {
  const summary = getProfessionalSummary(professionalSummaryId);
  if (!summary) return false;
  return summary.status === "OPENED";
}

/**
 * Check if a professional summary has received a response
 */
export function hasProfessionalSummaryReceivedResponse(professionalSummaryId: string): boolean {
  const summary = getProfessionalSummary(professionalSummaryId);
  if (!summary) return false;
  return summary.status === "RESPONSE_RECEIVED";
}

/**
 * Reset all professional summary data (for testing)
 */
export function resetProfessionalSummaryStore(): void {
  resetEntityStore();
}