/**
 * Direct first-use path: a caregiver can enter the Living Care Record immediately.
 * Public information remains available, but it must not be an access gate.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { WELCOME_HOME } from "../src/lib/trust-content";
import { PUBLIC_TRUST_LAYER } from "../src/lib/solenos-layers/architecture-map";

const root = process.cwd();
const landing = fs.readFileSync(path.join(root, "src/app/page.tsx"), "utf8");
const start = fs.readFileSync(path.join(root, "src/app/start/page.tsx"), "utf8");
const earlyAccess = fs.readFileSync(path.join(root, "src/app/early-access/page.tsx"), "utf8");
const workspace = fs.readFileSync(path.join(root, "src/app/workspace/page.tsx"), "utf8");
const layout = fs.readFileSync(path.join(root, "src/app/workspace/layout.tsx"), "utf8");
const shell = fs.readFileSync(path.join(root, "src/components/public/PublicShell.tsx"), "utf8");

assert.equal(PUBLIC_TRUST_LAYER.enterCareRecord, "/workspace?enter=1");
assert.equal(WELCOME_HOME.primaryCtaHref, "/workspace?enter=1");
assert.match(landing, /const start = "\/workspace\?enter=1"/);
assert.match(landing, /href=\{start\}/);
assert.match(start, /primaryCtaHref/);
assert.match(earlyAccess, /href="\/workspace\?enter=1"/);
assert.match(shell, /href="\/workspace\?enter=1"/);
assert.match(workspace, /CognitiveWorkspace/);
assert.doesNotMatch(earlyAccess, /EarlyAccessConsentForm|type="checkbox"|ResearchPreviewAckGate/);
assert.doesNotMatch(layout, /ConsentGatePanel|WorkspacePrivacyBoundary|ResearchPreviewAckGate|type="checkbox"/);

const addPanel = fs.readFileSync(path.join(root, "src/components/mvp-workspace/AddSituationPanel.tsx"), "utf8");
assert.doesNotMatch(addPanel, /Dump the mess/i);
assert.doesNotMatch(addPanel, /\bMVP\b/);
assert.doesNotMatch(addPanel, /Dad has been refusing/i);

console.log("✓ first-use and returning caregivers can open the LCR without an acknowledgement gate");
