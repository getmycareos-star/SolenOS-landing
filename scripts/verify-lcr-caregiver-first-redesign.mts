import assert from "node:assert/strict";
import fs from "node:fs";

const legacyRoute = fs.readFileSync("src/app/workspace/record/page.tsx", "utf8");
const capture = fs.readFileSync("src/components/mvp-workspace/CognitiveWorkspace.tsx", "utf8");
const styles = fs.readFileSync("src/app/mobile-app.css", "utf8");
const workspaceLayout = fs.readFileSync("src/app/workspace/layout.tsx", "utf8");
const dailyCare = fs.readFileSync("src/app/workspace/daily-care/page.tsx", "utf8");

assert.match(legacyRoute, /redirect\("\/workspace"\)/, "old LCR home must redirect to the Companion");
assert.doesNotMatch(legacyRoute, /SOLENOS · LIVING CARE RECORD|Record timeline|Add to record|CognitiveWorkspace/, "old LCR interface must not be rendered as a separate home");
assert.doesNotMatch(capture, /ConsentGatePanel|consentState !== "accepted"|ResearchPreviewAckGate/, "care-record capture is not blocked by acknowledgement checkboxes");
assert.doesNotMatch(capture, /HelpImproveSolenos|QwenAssistPanel/, "capture workspace does not interleave feedback or a separate AI chat panel");
assert.match(capture, /Add information to the shared care record/, "underlying care-record capture remains implemented");
assert.match(dailyCare, /StructuredDailyCapture/, "Daily Care retains its structured capture workflow");
assert.doesNotMatch(dailyCare, /DailyCareQwen|daily-care\/intelligence\/ask/, "Daily Care has no embedded AI agent");
assert.doesNotMatch(workspaceLayout, /type="checkbox"|ResearchPreviewAckGate|ConsentGatePanel/, "workspace route mounts without a pre-entry checkbox");
assert.match(styles, /\.lcr-home/, "existing responsive LCR style system is preserved for continuity components");
assert.match(styles, /@media \(max-width: 540px\)/, "mobile layout remains explicitly handled");

console.log("✓ legacy LCR home is not exposed; its route returns caregivers to the AI Companion");
console.log("✓ underlying capture and longitudinal continuity components remain in the codebase");
console.log("✓ Daily Care remains structured capture only, without an embedded AI agent");
