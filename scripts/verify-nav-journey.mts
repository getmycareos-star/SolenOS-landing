/**
 * Navigation journey: / → /start → /workspace
 * Enter SolenOS CTA must be a real route (not waitlist-only).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PUBLIC_TRUST_LAYER } from "../src/lib/solenos-layers/architecture-map";
import { WELCOME_HOME } from "../src/lib/trust-content";

const root = process.cwd();

console.log("=== SolenOS nav journey ===\n");

assert.equal(PUBLIC_TRUST_LAYER.firstVisitLanding, "/start");
assert.equal(PUBLIC_TRUST_LAYER.enterCareRecord, "/workspace?enter=1");
assert.ok(WELCOME_HOME.primaryCtaHref.includes("/workspace"));
assert.ok(WELCOME_HOME.primaryCtaHref.includes("enter=1"));

const landing = fs.readFileSync(path.join(root, "src/app/page.tsx"), "utf8");
assert.ok(landing.includes("Enter SolenOS"));
assert.ok(landing.includes('href="/start"'));
assert.ok(!landing.includes("CognitiveWorkspace"));

const start = fs.readFileSync(path.join(root, "src/app/start/page.tsx"), "utf8");
assert.ok(start.includes("WelcomeTrustStack"));
assert.ok(start.includes("WELCOME_HOME"));

const welcome = fs.readFileSync(path.join(root, "src/app/welcome/page.tsx"), "utf8");
assert.ok(welcome.includes('redirect("/start")'));

const workspace = fs.readFileSync(path.join(root, "src/app/workspace/page.tsx"), "utf8");
assert.ok(workspace.includes("CognitiveWorkspace"));
assert.ok(workspace.includes("ResearchPreviewAckGate"));
assert.ok(workspace.includes('"/start"') || workspace.includes("'/start'"));
assert.ok(workspace.includes("ensureClientDurableCareKey"));

const shell = fs.readFileSync(path.join(root, "src/components/public/PublicShell.tsx"), "utf8");
assert.ok(shell.includes("/workspace?enter=1"));

console.log("✓ / → Enter SolenOS → /start → /workspace wired");
console.log("\n=== Nav journey: all checks passed ===\n");
