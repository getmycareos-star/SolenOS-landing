import assert from "node:assert/strict";
import fs from "node:fs";

const landing = fs.readFileSync("src/app/page.tsx", "utf8");
const shell = fs.readFileSync("src/components/public/PublicShell.tsx", "utf8");
const start = fs.readFileSync("src/app/start/page.tsx", "utf8");
const earlyAccess = fs.readFileSync("src/app/early-access/page.tsx", "utf8");
const workspaceLayout = fs.readFileSync("src/app/workspace/layout.tsx", "utf8");
const cognitiveWorkspace = fs.readFileSync("src/components/mvp-workspace/CognitiveWorkspace.tsx", "utf8");

assert.match(landing, /const start = "\/workspace\?enter=1"/,
  "primary landing CTA targets the LCR directly");
assert.match(landing, /href=\{start\}/,
  "landing CTA uses the direct LCR target");
assert.match(shell, /href="\/workspace\?enter=1"/,
  "public navigation provides direct LCR entry");
assert.match(start, /primaryCtaHref/,
  "optional informational start page retains its direct LCR CTA");
assert.match(earlyAccess, /href="\/workspace\?enter=1"/,
  "early-access CTA opens the LCR directly");
assert.doesNotMatch(earlyAccess, /EarlyAccessConsentForm|type="checkbox"|ResearchPreviewAckGate/,
  "early-access path contains no pre-workspace acknowledgement gate");
assert.doesNotMatch(workspaceLayout, /ConsentGatePanel|WorkspacePrivacyBoundary|ResearchPreviewAckGate|type="checkbox"/,
  "workspace layout contains no pre-workspace checkbox gate");
assert.match(workspaceLayout, /<WorkspaceProvider>/,
  "workspace provider mounts without waiting for a checkbox");
assert.doesNotMatch(cognitiveWorkspace, /ConsentGatePanel|consentState !== "accepted"|Retry the privacy check|type="checkbox"/,
  "the rendered LCR experience must not reintroduce a hidden acknowledgement gate");

console.log("✓ every use-the-LCR CTA routes directly to the workspace");
console.log("✓ privacy/terms remain informational links, not an entry checkbox gate");
