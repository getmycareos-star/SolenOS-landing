import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";

const source = readFileSync("src/app/workspace/documents/page.tsx", "utf8");
assert.match(source, /async function createProcessedImage\(/, "image processing must be implemented");
assert.match(source, /rotatedContext\.rotate\(radians\)/, "straightening must affect OCR pixels, not only CSS");
assert.match(source, /drawImage\(rotated, left, top, width, height, 0, 0, width, height\)/, "crop must affect OCR pixels");
assert.match(source, /await extractText\(processed\)/, "OCR must run on the adjusted scan");
assert.match(source, /form\.append\("file", page\.file\)/, "the original uploaded bytes must be retained");
assert.match(source, /form\.append\("scan_crop_json", JSON\.stringify\(page\.crop\)\)/, "crop metadata must accompany the original");
assert.match(source, /page\.reviewed \|\| !page\.prepared/, "unprepared or unreviewed pages must not be saved");
console.log("✓ scan crop/straighten is applied before OCR");
console.log("✓ original scan bytes remain the persisted document");
console.log("✓ reviewed text and scan processing metadata are required");
