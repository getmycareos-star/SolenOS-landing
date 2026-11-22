import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";

const lcr = readFileSync("src/components/mvp-workspace/LCRCurrentUnderstanding.tsx", "utf8");
const continuity = readFileSync("src/components/CareContinuityIntegrityPanel.tsx", "utf8");

const source = readFileSync("src/components/DocumentIntelligenceReview.tsx", "utf8");
const capture = readFileSync("src/components/mvp-workspace/capture/extract-attached.ts", "utf8");
const documentsPage = readFileSync("src/app/workspace/documents/page.tsx", "utf8");

assert(
  source.includes("/documents/intelligence/") && source.includes("/review-history"),
  "document review UI must retrieve the persisted append-only decision history",
);
assert(source.includes("reviewEvents"), "review history events must be retained in component state");
assert(source.includes("decision_version"), "each displayed decision must retain its per-candidate version");
assert(source.includes("historyErrors") && source.includes("A missing history does not mean no earlier decision was made"), "failed history retrieval must not be presented as an empty history");
assert(source.includes("Review history") && source.includes("loadReviewHistory"), "caregivers must be able to open the persisted review history");
assert(source.includes("corrected_pending_approval"), "corrections must remain pending until explicitly accepted");
assert(source.includes("Text SolenOS read from the document") && source.includes("candidate.source_quote"), "each candidate must show its exact source quotation in plain language");
assert(
  source.includes("caregiverSafeGeneratedText(candidate.subject)") &&
  source.includes("caregiverSafeGeneratedText(candidate.observation)"),
  "generated document subjects and observations must pass through the caregiver-language boundary",
);
assert(
  source.includes("candidateNeedsRewrite") &&
  source.includes("disabled={busy !== null || candidateNeedsRewrite}") &&
  source.includes("disabled={busy !== null || !hasCorrectionSubject}") &&
  source.includes("Check the original document and add a short label in plain words. The text SolenOS read will stay unchanged."),
  "an unreadable generated suggestion must be corrected using the preserved original wording before it can be accepted",
);
assert(
  source.includes("corrected_observation: sourceQuote") &&
  source.includes("Text SolenOS read from the document") &&
  source.includes("readOnly") &&
  source.includes("hasCorrectionSubject") &&
  !source.includes("sourceQuote.toLowerCase().includes(correctedSubject.trim().toLowerCase())"),
  "document corrections must preserve the exact source quotation while allowing a separate caregiver-authored label",
);
assert(
  source.includes('candidate.review_status === "corrected_pending_approval"') &&
  source.includes("{candidate.source_quote ||") &&
  !source.includes("caregiverSafeAssistantText(candidate.source_quote)"),
  "saved corrections and original source wording must remain visible after reload",
);
assert(source.includes("No care-related details were found in this document. Nothing was added to your Care Record."), "empty interpretation must not imply a care fact");
assert(
  source.includes("You can check the original document and the text SolenOS read"),
  "the UI must not describe the server extraction path as text-only",
);

console.log("✓ persisted document review history is loaded and displayed");
assert(source.includes('reviewResult.written_to_lcr !== true') && source.includes('reviewResult.source_record_ref?.record_id'), "acceptance must require a persisted assertion receipt before notifying the LCR");
assert(source.includes('new Event("careRecordUpdated")'), "acceptance must notify the active LCR view after the backend confirms the write");
assert(lcr.includes('addEventListener("careRecordUpdated"') && lcr.includes('removeEventListener("careRecordUpdated"'), "the LCR projection must reload after a document assertion is accepted");
assert(lcr.includes("DOCUMENT_ASSERTION_LABELS") && lcr.includes("Medication information from document"), "typed document assertions must render as caregiver-readable LCR entries");
assert(continuity.includes('addEventListener("careRecordUpdated"') && continuity.includes('removeEventListener("careRecordUpdated"'), "the care-continuity assertion panel must reload after a document assertion is accepted");

console.log("✓ decision versions, pending corrections and source-quotation boundaries are explicit");

assert(capture.includes('postFormData("/upload"'), "capture must persist the original bytes before returning to the caregiver");
const captureStart = capture.indexOf("export async function extractAttachedDocument");
const captureEnd = capture.indexOf("export async function retryAttachedDocument", captureStart);
const captureSource = capture.slice(captureStart, captureEnd);
assert(captureStart >= 0 && captureEnd > captureStart, "the initial capture function must remain independently verifiable");
assert(!captureSource.includes('"/documents/" + encodeURIComponent(evidenceId) + "/extract"'), "initial capture must not block on synchronous extraction");
assert(!captureSource.includes('"/documents/" + encodeURIComponent(evidenceId) + "/intelligence"'), "initial capture must not block on synchronous Qwen interpretation");
assert(captureSource.includes("durably queues document extraction and understanding"), "the server must own background processing after the original is saved");
assert(!capture.includes('apiUrl("/api/extract"'), "capture must not depend on the legacy extract-before-upload endpoint");
assert(!documentsPage.includes('apiUrl("/api/extract"'), "the Documents screen must not send the same original to a preflight extractor and then upload it again");
assert(!documentsPage.includes("Extracted text — review and correct before saving"), "the Documents screen must not ask caregivers to edit text that the upload endpoint discards");
assert(!documentsPage.includes("review and correct its extracted text first"), "the Documents screen must not ask caregivers to review discarded client-side OCR before saving");
assert(!documentsPage.includes('aria-label="Review extracted text before saving"'), "the Documents screen must not present pre-upload text review as a required workflow");
assert(!documentsPage.includes('form.append("extracted_text"'), "only server extraction from the persisted original may become reviewable source text");
assert(source.includes('/documents/analyses/') && source.includes("loadExtractedText"), "the Documents review panel must retrieve persisted server extraction, not client-only OCR text");
const retryStart = capture.indexOf("export async function retryAttachedDocument");
const retryEnd = capture.indexOf("export function dataUrlToFile", retryStart);
const retrySource = capture.slice(retryStart, retryEnd);
const addSituation = readFileSync("src/components/mvp-workspace/AddSituationPanel.tsx", "utf8");
assert(retryStart >= 0 && retryEnd > retryStart && retrySource.includes("document.evidenceId") && !retrySource.includes("postFormData"), "retry must operate on the existing evidence ID without creating a duplicate upload");
assert(retrySource.includes('"/documents/" + encodeURIComponent(document.evidenceId) + "/queue"'), "retry must resume the durable worker without running OCR in the caregiver screen");
assert(addSituation.includes("retryAttachedDocument(doc)"), "the caregiver Retry action must reuse the persisted original");

assert(capture.includes('status: "failed"') && capture.includes('evidenceId,'), "an extraction failure must retain the evidence ID so the saved original remains recoverable");
const saveFunction = documentsPage.slice(documentsPage.indexOf("const saveReviewedPages"), documentsPage.indexOf("const openOriginal"));
assert(saveFunction.includes('postFormData("/upload"'), "the Documents scan/upload flow must persist each original page first");
assert(saveFunction.includes("document_processing_job_id"), "the Documents scan/upload flow must receive a durable background job receipt");
assert(!saveFunction.includes('"/extract"') && !saveFunction.includes('"/intelligence"'), "the Documents screen must not block caregivers while server extraction and understanding run");


console.log("✓ accepting a document observation refreshes the LCR and care-continuity panels");


assert(source.includes("source_attribution") && source.includes("negation_status"), "document candidates must preserve explicit reporter attribution and negation metadata");
assert(source.includes("modality") && source.includes("conditionality") && source.includes("temporal_context"), "document candidates must preserve tentative, conditional and historical wording");
assert(source.includes("statement_kind") && source.includes("A recommendation; no result has been recorded yet."), "recommendations must not be represented as completed outcomes");
assert(source.includes("Reported by the patient") && source.includes("Reported by a family caregiver") && source.includes("Documented or observed by a care professional"), "caregivers must be able to distinguish the explicit source of a statement");
assert(source.includes("Says this did not happen") && source.includes("Not certain") && source.includes("Only applies in some situations") && source.includes("Historical information"), "caregivers must see qualifiers before accepting document-derived details");

console.log("✓ negation, uncertainty, conditionality, historical context and attribution remain visible in review");


assert(lcr.includes("source_context") && lcr.includes("documentStatementContextLabels"), "the canonical LCR view must render source qualifiers persisted with accepted document assertions");
assert(lcr.includes("A recommendation; no result has been recorded yet.") && lcr.includes("Says this did not happen"), "the LCR must preserve recommendation and negation boundaries after acceptance");
assert(lcr.includes("Reported by the patient") && lcr.includes("Historical information"), "the LCR must retain reporter attribution and historical context after acceptance");

console.log("✓ accepted document qualifiers persist into and remain visible from the canonical LCR");


assert(lcr.includes("professional_documented") && lcr.includes("Documented by a care professional"), "professional documentation must not be represented as direct observation");
assert(lcr.includes("changed_over_time") && lcr.includes("Describes a change from an earlier state"), "a changed state must not be mislabeled as purely historical");
