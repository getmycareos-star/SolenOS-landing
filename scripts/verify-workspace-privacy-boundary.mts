import assert from "node:assert/strict";
import fs from "node:fs";

const layout = fs.readFileSync("src/app/workspace/layout.tsx", "utf8");
const legacyRecordRoute = fs.readFileSync("src/app/workspace/record/page.tsx", "utf8");
const companionHome = fs.readFileSync("src/app/workspace/page.tsx", "utf8");
const consentPanel = fs.readFileSync("src/components/mvp-workspace/ConsentGatePanel.tsx", "utf8");
const previewGate = fs.readFileSync("src/components/mvp-workspace/ResearchPreviewAckGate.tsx", "utf8");

assert.doesNotMatch(layout, /WorkspacePrivacyBoundary|ConsentGatePanel|consentState !== "accepted"/,
  "workspace layout must not block entry behind a privacy checkbox");
assert.match(layout, /<WorkspaceProvider>\s*<ErrorBoundary/,
  "workspace provider and shell mount directly");
assert.doesNotMatch(layout, /type="checkbox"|ResearchPreviewAckGate|EarlyAccessConsentForm/,
  "no acknowledgement checkbox may gate workspace routes");
assert.doesNotMatch(companionHome, /ResearchPreviewAckGate/,
  "the AI Companion home must not mount an early-version acknowledgement gate");
assert.match(legacyRecordRoute, /redirect\("\/workspace"\)/,
  "the legacy LCR route redirects to the AI Companion home");
assert.doesNotMatch(legacyRecordRoute, /ResearchPreviewAckGate|ConsentGatePanel|Living Care Record/,
  "the old LCR page is not rendered or used as a workspace destination");
assert.match(previewGate, /RESEARCH_PREVIEW_SECTION\.ackLabel|early version/i,
  "legacy component remains identifiable for regression detection, but must not be mounted in the workspace");
assert.match(consentPanel, /api\/v1\/consent/,
  "legacy consent API integration may remain for action-specific backend policy; it must not gate workspace entry");

console.log("✓ workspace routes mount without a privacy or early-version checkbox gate");
console.log("✓ direct workspace entry does not disable server-side authentication or authorisation");
