/**
 * Direct LCR entry contract.
 * Any CTA that says to use/open the Living Care Record must route directly to /workspace.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PUBLIC_TRUST_LAYER } from "../src/lib/solenos-layers/architecture-map";
import { WELCOME_HOME } from "../src/lib/trust-content";

const root = process.cwd();
const landing = fs.readFileSync(path.join(root, "src/app/page.tsx"), "utf8");
const start = fs.readFileSync(path.join(root, "src/app/start/page.tsx"), "utf8");
const earlyAccess = fs.readFileSync(path.join(root, "src/app/early-access/page.tsx"), "utf8");
const shell = fs.readFileSync(path.join(root, "src/components/public/PublicShell.tsx"), "utf8");
const layout = fs.readFileSync(path.join(root, "src/app/workspace/layout.tsx"), "utf8");

assert.equal(PUBLIC_TRUST_LAYER.enterCareRecord, "/workspace?enter=1");
assert.match(WELCOME_HOME.primaryCtaHref, /^\/workspace\?enter=1$/);
assert.match(landing, /const start = "\/workspace\?enter=1"/);
assert.match(landing, /href=\{start\}/);
assert.match(start, /primaryCtaHref/);
assert.match(earlyAccess, /href="\/workspace\?enter=1"/);
assert.match(shell, /href="\/workspace\?enter=1"/);
assert.doesNotMatch(earlyAccess, /EarlyAccessConsentForm|type="checkbox"|ResearchPreviewAckGate/);
assert.doesNotMatch(layout, /ConsentGatePanel|WorkspacePrivacyBoundary|ResearchPreviewAckGate|type="checkbox"/);
assert.match(layout, /<WorkspaceProvider>/);

console.log("✓ primary, navigation, start, and early-access CTAs route directly to the LCR");
console.log("✓ workspace access is not blocked by a checkbox or acknowledgement overlay");
