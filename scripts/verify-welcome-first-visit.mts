/**
 * verify-welcome-first-visit.mts
 * First-time caregivers must see /start (Entry Home) before /workspace.
 * Legacy /welcome redirects to /start.
 */

import fs from "node:fs";
import path from "node:path";

import {
  ENTER_CARE_QUERY,
  SOLENOS_ENTERED_CARE_STORAGE_KEY,
} from "../src/lib/care-entry";
import { PUBLIC_TRUST_LAYER } from "../src/lib/solenos-layers/architecture-map";
import { EMPTY_STATE_TRUST, WELCOME_HOME } from "../src/lib/trust-content";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== SolenOS entry-first (/start → /workspace) ===\n");

assert(PUBLIC_TRUST_LAYER.firstVisitLanding === "/start", "first visit lands on /start");
assert(
  PUBLIC_TRUST_LAYER.enterCareRecord === "/workspace?enter=1",
  "enter CTA uses /workspace?enter=1",
);
assert(ENTER_CARE_QUERY === "enter", "enter query constant");
assert(SOLENOS_ENTERED_CARE_STORAGE_KEY.includes("entered_care"), "entered storage key");

assert(WELCOME_HOME.primaryCtaHref.includes("enter=1"), "entry CTA enters care record");
assert(WELCOME_HOME.primaryCtaHref.includes("/workspace"), "entry CTA targets workspace");
assert(/what matters/i.test(WELCOME_HOME.bullets.join(" ")), "welcome promises what matters");
assert(/can wait/i.test(WELCOME_HOME.bullets.join(" ")), "welcome promises what can wait");
assert(/ask/i.test(WELCOME_HOME.bullets.join(" ")), "welcome promises what to ask");
assert(/serious/i.test(WELCOME_HOME.bullets.join(" ")), "welcome promises what may become serious");
assert(!/mvp/i.test(JSON.stringify(WELCOME_HOME)), "welcome copy must not say MVP");
assert(!/dump the mess/i.test(JSON.stringify(WELCOME_HOME)), "welcome must not dump framing");

assert(!/welcome to solenos/i.test(EMPTY_STATE_TRUST.title), "empty state avoids forbidden welcome phrase");
assert(/living care record/i.test(EMPTY_STATE_TRUST.title), "empty state is Living Care Record oriented");
assert(
  /care situation|organize what matters/i.test(EMPTY_STATE_TRUST.body),
  "empty state invites capture → organize",
);

const startPage = fs.readFileSync(path.join(root, "src/app/start/page.tsx"), "utf8");
assert(startPage.includes("WELCOME_HOME"), "start page uses WELCOME_HOME");
assert(startPage.includes("SolenosWordmark"), "start brand is hero-level");
assert(startPage.includes("primaryCtaHref"), "start uses enter CTA");

const welcomePage = fs.readFileSync(path.join(root, "src/app/welcome/page.tsx"), "utf8");
assert(welcomePage.includes('redirect("/start")'), "legacy /welcome redirects to /start");

const landingPage = fs.readFileSync(path.join(root, "src/app/page.tsx"), "utf8");
assert(landingPage.includes("Enter SolenOS"), "landing CTA Enter SolenOS");
assert(landingPage.includes('href="/start"'), "landing CTA goes to /start");

const workspacePage = fs.readFileSync(path.join(root, "src/app/workspace/page.tsx"), "utf8");
assert(workspacePage.includes("hasEnteredCareRecord"), "workspace gates on entered care record");
assert(
  workspacePage.includes('"/start"') || workspacePage.includes("'/start'"),
  "workspace redirects first visit to /start",
);
assert(workspacePage.includes("markEnteredCareRecord"), "workspace marks entry after CTA");
assert(workspacePage.includes("ensureClientDurableCareKey"), "workspace reuses durable care key");
assert(!/freshEnter\s*\?\s*mintDurableCareKey/.test(workspacePage), "Begin must not mint a new care reality");
assert(workspacePage.includes("CognitiveWorkspace"), "workspace mounts CognitiveWorkspace");
assert(workspacePage.includes("ResearchPreviewAckGate"), "workspace has research preview ack");

const addPanel = fs.readFileSync(
  path.join(root, "src/components/mvp-workspace/AddSituationPanel.tsx"),
  "utf8",
);
assert(!/Dump the mess/i.test(addPanel), "composer must not say Dump the mess");
assert(!/\bMVP\b/.test(addPanel), "composer must not frame as MVP");
assert(!/Dad has been refusing/i.test(addPanel), "no guided example placeholder (Locked B)");
assert(
  /Help SolenOS understand|organize what matters|preserve and understand/i.test(addPanel),
  "first-time composer: light orientation then capture",
);
assert(
  /stop explaining|isFirstCapture|mode === "update"/i.test(addPanel),
  "after first capture: stop product lectures",
);

const workspace = fs.readFileSync(
  path.join(root, "src/components/mvp-workspace/CognitiveWorkspace.tsx"),
  "utf8",
);
assert(
  /sessionHasNote \|\| hasContextRoot/.test(workspace),
  "name gate only after first value — not pre-capture onboarding",
);
assert(/nameAskDismissed/.test(workspace), "name ask can be skipped");
assert(!/Loading your care context/.test(workspace), "do not fabricate care context while loading");

const shell = fs.readFileSync(path.join(root, "src/components/public/PublicShell.tsx"), "utf8");
assert(shell.includes("/workspace?enter=1"), "public shell CTA enters care record");
assert(!/Open SolenOS/.test(shell), "nav must not use generic Open SolenOS for caregivers");

console.log("✓ /start is first-time entry; /workspace is Care Record; Locked B capture");
console.log("\n=== Entry first visit: all checks passed ===\n");
