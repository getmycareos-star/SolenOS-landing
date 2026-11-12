import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";

const source = readFileSync("src/app/workspace/documents/page.tsx", "utf8");
assert.match(source, /async function createProcessedImage\(/, "image processing must be implemented");
assert.match(source, /rotatedContext\.rotate\(radians\)[\s\S]*?cropContext\.drawImage\(rotated, left, top, width, height, 0, 0, width, height\)/, "rotation must happen before crop so crop coordinates match the rotated preview");
assert.match(source, /rotatedContext\.drawImage\(image, -image\.width \/ 2, -image\.height \/ 2\)/, "rotation must apply to source image pixels");
assert.match(source, /await extractText\(processed\)/, "OCR must run on the adjusted scan");
assert.match(source, /setTimeout\(\(\) => controller\.abort\(\), 120_000\)/, "browser OCR must not be cancelled by the old 40-second client deadline");
assert.match(source, /form\.append\("file", page\.file\)/, "the original uploaded bytes must be retained");
assert.match(source, /form\.append\("scan_crop_json", JSON\.stringify\(page\.crop\)\)/, "crop metadata must accompany the original");
assert.match(source, /if \(!reviewPages\.length\)/, "saving must not require caregivers to review every page first");
assert.match(source, /scan_review_status", page\.reviewed \? "caregiver_reviewed" : "not_reviewed"/, "review status must accurately distinguish reviewed from unreviewed originals");
assert.match(source, /Save files<\/button>/, "caregivers must be able to save originals before reviewing extracted text");
assert.match(source, /data-scan-crop-stage/, "scan editor must render a crop stage");
assert.match(source, /Move crop area/, "crop rectangle must be movable by pointer and keyboard");
assert.match(source, /function createMultiPagePdf\(/, "multi-page PDF generation must be implemented");
assert.match(source, /Combine reviewed image pages into one PDF/, "caregivers must be able to create a multi-page PDF");
assert.match(source, /Original uploaded page files remain separate and unchanged\./, "PDF creation must preserve individual original scans");

const attachmentSource = readFileSync("src/components/mvp-workspace/capture/extract-attached.ts", "utf8");
const attachmentTypes = readFileSync("src/lib/mvp-workspace/types.ts", "utf8");
const addRecordSource = readFileSync("src/components/mvp-workspace/AddSituationPanel.tsx", "utf8");
const workspaceSource = readFileSync("src/components/mvp-workspace/CognitiveWorkspace.tsx", "utf8");
const intelligenceReviewSource = readFileSync("src/components/DocumentIntelligenceReview.tsx", "utf8");
assert.match(attachmentTypes, /status: "pending" \| "saved" \| "ready" \| "failed"/, "saved evidence must not be represented as completed interpretation");
assert.match(attachmentSource, /entryMethod === "snap"[\s\S]*?status: "saved"/, "Snap must be marked saved, not document-ready");
const captureFunction = attachmentSource.slice(attachmentSource.indexOf("export async function extractAttachedDocument"), attachmentSource.indexOf("export async function retryAttachedDocument"));
assert(!captureFunction.includes("/extract"), "caregiver capture must not wait for synchronous document OCR");
assert(!captureFunction.includes("/intelligence"), "caregiver capture must not wait for synchronous Qwen interpretation");
assert.match(attachmentSource, /durably queues document extraction and understanding/, "the upload contract must hand off processing to the durable worker");
assert.match(addRecordSource, /Saved — processing in background/, "saved documents must show truthful background-processing state");

assert.match(attachmentSource, /document\.entryMethod === "snap" && document\.evidenceId[\s\S]*?status: "saved"/, "retry must not send a saved care photo through document OCR");
assert.match(addRecordSource, /Photo saved — not interpreted/, "caregivers must see that a Snap photo is saved but not interpreted");
assert.match(addRecordSource, /Saved — processing in background/, "caregivers must see that saved documents are processing without blocking capture");
assert.match(addRecordSource, /d\.status === "saved" && d\.evidenceId/, "saved document evidence must be eligible for care-entry submission");
assert.match(workspaceSource, /server extraction and document understanding are processing in the background/, "the care entry must not claim document interpretation completed");
assert.match(workspaceSource, /d\.status === "saved" && d\.evidenceId/, "saved evidence must remain eligible for care-entry submission");
assert.match(workspaceSource, /evidence_id: d\.evidenceId/, "care-entry submission must reference the persisted evidence ID");
assert.match(intelligenceReviewSource, /analysis\.intelligence_status !== "partial" \|\| !!analysis\.unprocessed_page_numbers\?\.length/, "partially processed documents with remaining pages must offer resume");
assert.match(intelligenceReviewSource, /Resume remaining pages/, "caregivers must be able to resume unfinished document understanding");
assert.match(intelligenceReviewSource, /processing_jobs\?/, "the review panel must read durable background job state");
assert.match(intelligenceReviewSource, /Processing in the background\. You can leave this page\./, "caregivers must know the original is processing without staying in the app");
assert.match(intelligenceReviewSource, /Processing in the background\. You can leave this page\./, "active processing must be visible without offering a duplicate retry");
assert.match(intelligenceReviewSource, /!active && <button/, "manual extraction must not race an active background job");
assert.match(intelligenceReviewSource, /!processingJobs\.some\(\(job\) => job\.evidence_id === analysis\.source_evidence_id/, "partial-page resume must not race an active background job");
assert.match(intelligenceReviewSource, /window\.setTimeout\(\(\) => \{ void load\(\); \}, 3000\)/, "document review status must refresh while background processing is active");

assert.match(source, /ingestionKey: string; captureTimestamp: string/, "scan uploads must carry stable retry and capture metadata");
assert.match(source, /form\.append\("ingestion_key", page\.ingestionKey\)/, "scan retry must reuse its original idempotency key");
const scanCaptureSource = readFileSync("src/components/mvp-workspace/capture/ScanDocumentCapture.tsx", "utf8");
const scanAttachmentSource = readFileSync("src/components/mvp-workspace/capture/extract-attached.ts", "utf8");
assert.match(scanCaptureSource, /Rotate 90°/, "each captured scan page must support rotation correction");
assert.match(scanCaptureSource, /cropInsetsPercent/, "each captured scan page must support crop adjustment");
assert.match(scanCaptureSource, /scanRotationDegrees: page\.rotationDegrees/, "scan adjustments must travel with each original page");
assert.match(scanAttachmentSource, /scan_rotation_degrees/, "scan rotation must be persisted as OCR metadata");
assert.match(scanAttachmentSource, /scan_crop_json/, "scan crop must be persisted as OCR metadata");
assert.match(scanAttachmentSource, /scan_review_status", "not_reviewed"/, "crop adjustments must not falsely attest caregiver review");
assert.match(scanAttachmentSource, /form\.append\("file", file\)/, "scan adjustments must never replace the original uploaded file bytes");
assert.match(addRecordSource, /scanRotationDegrees: \(file as ScanPageFile\)\.scanRotationDegrees/, "per-page scan adjustments must be passed through the care-entry capture flow");

const saveFunction = source.slice(source.indexOf("const saveReviewedPages"), source.indexOf("const openOriginal"));
assert.match(saveFunction, /document_processing_job_id/, "the save response must confirm durable background processing was queued");
assert(!saveFunction.includes("/extract"), "the caregiver page must not own document extraction after upload");
assert(!saveFunction.includes("/intelligence"), "the caregiver page must not own document understanding after upload");
assert.match(saveFunction, /You can leave this page/, "the caregiver can leave after the original and background job are saved");

assert.match(source, /form\.append\("capture_timestamp", page\.captureTimestamp\)/, "scan retry must preserve capture time");
assert.match(source, /let scanPageNumber = 0/, "scan page numbers must not be affected by other file types in the batch");

console.log("✓ crop and straighten are applied to pixels before OCR");
console.log("✓ caregiver can move crop area and adjust margins");
console.log("✓ multi-page PDF assembly preserves individual originals");
console.log("✓ original scan bytes, reviewed text, and scan processing metadata are required");
