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
assert.match(attachmentTypes, /status: "pending" \| "saved" \| "ready" \| "failed"/, "saved evidence must not be represented as completed interpretation");
assert.match(attachmentSource, /entryMethod === "snap"[\s\S]*?status: "saved"/, "Snap must be marked saved, not document-ready");
assert.match(attachmentSource, /document\.entryMethod === "snap" && document\.evidenceId[\s\S]*?status: "saved"/, "retry must not send a saved care photo through document OCR");
assert.match(addRecordSource, /Photo saved — not interpreted/, "caregivers must see that a Snap photo is saved but not interpreted");
assert.match(workspaceSource, /d\.status === "saved" && d\.entryMethod === "snap" && d\.evidenceId/, "saved Snap evidence must remain eligible for care-entry submission");
assert.match(workspaceSource, /evidence_id: d\.evidenceId/, "care-entry submission must reference the persisted evidence ID");
assert.match(source, /ingestionKey: string; captureTimestamp: string/, "scan uploads must carry stable retry and capture metadata");
assert.match(source, /form\.append\("ingestion_key", page\.ingestionKey\)/, "scan retry must reuse its original idempotency key");
assert.match(source, /form\.append\("capture_timestamp", page\.captureTimestamp\)/, "scan retry must preserve capture time");
assert.match(source, /let scanPageNumber = 0/, "scan page numbers must not be affected by other file types in the batch");

console.log("✓ crop and straighten are applied to pixels before OCR");
console.log("✓ caregiver can move crop area and adjust margins");
console.log("✓ multi-page PDF assembly preserves individual originals");
console.log("✓ original scan bytes, reviewed text, and scan processing metadata are required");
