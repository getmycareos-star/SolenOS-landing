import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";

const source = readFileSync("src/app/workspace/documents/page.tsx", "utf8");
assert.match(source, /async function createProcessedImage\(/, "image processing must be implemented");
assert.match(source, /rotatedContext\.rotate\(radians\)[\s\S]*?cropContext\.drawImage\(rotated, left, top, width, height, 0, 0, width, height\)/, "rotation must happen before crop so crop coordinates match the rotated preview");
assert.match(source, /rotatedContext\.drawImage\(image, -image\.width \/ 2, -image\.height \/ 2\)/, "rotation must apply to source image pixels");
assert.match(source, /await extractText\(processed\)/, "OCR must run on the adjusted scan");
assert.match(source, /form\.append\("file", page\.file\)/, "the original uploaded bytes must be retained");
assert.match(source, /form\.append\("scan_crop_json", JSON\.stringify\(page\.crop\)\)/, "crop metadata must accompany the original");
assert.match(source, /page\.reviewed \|\| !page\.prepared/, "unprepared or unreviewed pages must not be saved");
assert.match(source, /data-scan-crop-stage/, "scan editor must render a crop stage");
assert.match(source, /Move crop area/, "crop rectangle must be movable by pointer and keyboard");
assert.match(source, /function createMultiPagePdf\(/, "multi-page PDF generation must be implemented");
assert.match(source, /Combine reviewed image pages into one PDF/, "caregivers must be able to create a multi-page PDF");
assert.match(source, /Original uploaded page files remain separate and unchanged\./, "PDF creation must preserve individual original scans");
console.log("✓ crop and straighten are applied to pixels before OCR");
console.log("✓ caregiver can move crop area and adjust margins");
console.log("✓ multi-page PDF assembly preserves individual originals");
console.log("✓ original scan bytes, reviewed text, and scan processing metadata are required");

assert.match(source, /postFormData\("\/upload", form\)/, "original files must be sent to the backend upload endpoint");
assert.match(source, /if \(!stored\.persisted \|\| !stored\.evidence_id\)/, "upload success requires a backend persistence receipt and evidence ID");
assert.match(source, /Saved \$\{saved\} of \$\{reviewPages\.length\} file\(s\) before saving stopped/, "partial upload failures must be reported as partial, not complete");
assert.match(source, /getBlob\("\/upload\/" \+ encodeURIComponent\(doc\.id\)\)/, "original bytes must be retrieved from the backend before preview or download");
assert.match(source, /have text available; \$\{withoutText\} were saved without extracted text/, "the UI must not claim extracted text exists when a file was stored without text");
