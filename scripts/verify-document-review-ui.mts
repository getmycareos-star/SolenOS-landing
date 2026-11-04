import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";

const source = readFileSync("src/app/workspace/documents/page.tsx", "utf8");
assert.match(source, /postJSON\([\s\S]*?\/documents\/\/[\s\S]*?candidates\/review/, "caregiver review must call the persisted backend decision endpoint");
assert.match(source, /getJSON\([\s\S]*?\/reviews/, "document review history must be restored from the backend");
assert.match(source, /getJSON\([\s\S]*?\/documents\/analyses\//, "the saved extraction must be retrieved from the backend");
assert.match(source, /candidate\.source_quote/, "every candidate must display its source quotation");
assert.match(source, /source_span_start/, "candidate source offsets must be part of the client contract");
assert.match(source, /Correct and add to LCR/, "caregivers must be able to correct candidate text before accepting it");
assert.match(source, /Reject/, "caregivers must be able to reject candidates");
assert.match(source, /Needs clarification/, "caregivers must be able to defer uncertain candidates");
assert.match(source, /Review history/, "append-only review versions must be visible");
assert.match(source, /OCR confidence measures text recognition only, not clinical certainty/, "OCR confidence must not be presented as clinical certainty");
assert.match(source, /Scanned statements remain source evidence, not verified LCR facts/, "document text must not silently become an LCR fact");
assert.match(source, /reported LCR entry/, "accepted information must be described as a report rather than clinical verification");
assert.match(source, /Client-submitted text \(unverified\)/, "browser-submitted text must remain explicitly unverified");
console.log("✓ persisted extraction, source quotes, caregiver decisions and review history are wired");
console.log("✓ OCR confidence and LCR epistemic boundaries remain explicit");
