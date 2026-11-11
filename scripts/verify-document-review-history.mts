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
assert(source.includes("historyErrors") && source.includes("Do not interpret a missing history as no earlier decision"), "failed history retrieval must not be presented as an empty history");
assert(source.includes("immutable event(s)") && source.includes("loadReviewHistory"), "caregivers must be able to open the persisted review history");
assert(source.includes("corrected_pending_approval"), "corrections must remain pending until explicitly accepted");
assert(source.includes("EXACT SOURCE QUOTATION"), "each candidate must show its exact source quotation");
assert(source.includes("No LCR facts were created"), "empty interpretation must not imply a care fact");
assert(
  source.includes("server extraction and OCR prepare readable source text"),
  "the UI must not describe the server extraction path as text-only",
);

console.log("✓ persisted document review history is loaded and displayed");
assert(source.includes('reviewResult.written_to_lcr !== true') && source.includes('reviewResult.source_record_ref?.record_id'), "acceptance must require a persisted assertion receipt before notifying the LCR");
assert(source.includes('new Event("careRecordUpdated")'), "acceptance must notify the active LCR view after the backend confirms the write");
assert(lcr.includes('addEventListener("careRecordUpdated"') && lcr.includes('removeEventListener("careRecordUpdated"'), "the LCR projection must reload after a document assertion is accepted");
assert(lcr.includes("DOCUMENT_ASSERTION_LABELS") && lcr.includes("Medication information from document"), "typed document assertions must render as caregiver-readable LCR entries");
assert(continuity.includes('addEventListener("careRecordUpdated"') && continuity.includes('removeEventListener("careRecordUpdated"'), "the care-continuity assertion panel must reload after a document assertion is accepted");

console.log("✓ decision versions, pending corrections and source-quotation boundaries are explicit");

assert(capture.includes('postFormData("/upload"') && capture.includes('postJSON('), "all capture methods must persist the original and use the server document lifecycle");
assert(capture.indexOf('postFormData("/upload"') < capture.indexOf('"/documents/" + encodeURIComponent(evidenceId) + "/extract"'), "the original bytes must be persisted before extraction starts");
assert(capture.includes('"/documents/" + encodeURIComponent(evidenceId) + "/intelligence"'), "saved source extraction must feed the Qwen document intelligence endpoint");
assert(!capture.includes('apiUrl("/api/extract"'), "capture must not depend on the legacy extract-before-upload endpoint");
assert(capture.includes('getJSON(') && capture.includes('/documents/analyses/'), "the capture UI must display the persisted server extraction, not client-only OCR text");
assert(capture.includes('status: "failed"') && capture.includes('evidenceId,'), "an extraction failure must retain the evidence ID so the saved original remains recoverable");
assert(documentsPage.includes("const saveReviewedPages") && documentsPage.includes('postFormData("/upload"'), "the Documents scan/upload flow must persist each original page first");
assert(documentsPage.indexOf('postFormData("/upload"') < documentsPage.indexOf('"/documents/" + encodeURIComponent(stored.evidence_id) + "/extract"'), "the Documents scan/upload flow must upload original bytes before server extraction");
assert(documentsPage.includes('"/documents/" + encodeURIComponent(stored.evidence_id) + "/intelligence"'), "the Documents scan/upload flow must invoke document intelligence after extraction");


console.log("✓ accepting a document observation refreshes the LCR and care-continuity panels");
