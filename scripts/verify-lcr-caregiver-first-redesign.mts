import assert from "node:assert/strict";
import fs from "node:fs";

const workspacePage = fs.readFileSync("src/app/workspace/record/page.tsx", "utf8");
const capture = fs.readFileSync("src/components/mvp-workspace/CognitiveWorkspace.tsx", "utf8");
const styles = fs.readFileSync("src/app/mobile-app.css", "utf8");
const workspaceLayout = fs.readFileSync("src/app/workspace/layout.tsx", "utf8");

assert.match(workspacePage, /SOLENOS · LIVING CARE RECORD/, "workspace is visibly branded as the LCR");
assert.match(workspacePage, /Record timeline/, "LCR provides a longitudinal record timeline");
assert.match(workspacePage, /Add to record/, "primary action is adding information to the record");
assert.match(workspacePage, /Daily care/, "daily care remains available as a distinct capture flow");
assert.doesNotMatch(workspacePage, /Care handoffs|\/workspace\/handoffs|Deep care continuity/, "handoffs and technical continuity are not separate LCR home sections");
assert.doesNotMatch(capture, /ConsentGatePanel|consentState !== "accepted"|ResearchPreviewAckGate/, "LCR capture is not blocked by acknowledgement checkboxes");
assert.doesNotMatch(capture, /HelpImproveSolenos|QwenAssistPanel/, "capture workspace does not interleave feedback or a separate AI chat panel");
assert.match(capture, /Add information to the shared care record/, "capture keeps a clear, calm instruction");
assert.doesNotMatch(workspaceLayout, /type="checkbox"|ResearchPreviewAckGate|ConsentGatePanel/, "workspace route mounts without a pre-entry checkbox");
assert.match(styles, /\.lcr-home/, "LCR redesign styles are present");
assert.match(styles, /@media \(max-width: 540px\)/, "mobile layout is explicitly handled");

console.log("✓ LCR is a single caregiver-first workspace with no pre-entry checkbox gate");
console.log("✓ Add Record focuses on capture; no unrelated improvement or AI chat panel");
console.log("✓ No standalone care-handoff or deep-continuity section on the LCR home");
console.log("✓ Responsive LCR timeline and action hierarchy styles are present");
