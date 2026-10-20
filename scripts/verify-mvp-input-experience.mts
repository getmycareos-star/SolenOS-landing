/**
 * MVP Input Experience — Snap/Scan/Upload/Share; no auth before value.
 * SoT: docs/02-product/solenos-mvp-input-experience.md
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  MVP_INPUT_EXPERIENCE_PURPOSE,
  MVP_INPUT_PRIMARY_ACTIONS,
  MVP_INPUT_AUTH_POLICY,
  MVP_INPUT_SUCCESS_METRIC,
  MVP_INPUT_STARTING_QUESTION_FEEL,
  assertMvpInputAuthAllowsAnonymousCapture,
} from "../src/lib/mvp-input-experience";
import {
  MVP_COMPOSER_ENTRY_ACTIONS,
  assertEntryMethodDoesNotBranchReasoning,
} from "../src/lib/input-entry-contract";
import { ADOPTION_WEDGE_DEFINING_PRINCIPLE } from "../src/lib/adoption-wedge-engine/contract-constants";

const root = process.cwd();

console.log("=== MVP Input Experience ===\n");
console.log(MVP_INPUT_EXPERIENCE_PURPOSE);

assert.deepEqual([...MVP_INPUT_PRIMARY_ACTIONS], [...MVP_COMPOSER_ENTRY_ACTIONS]);
assert.deepEqual([...MVP_INPUT_PRIMARY_ACTIONS], ["scan", "snap", "upload", "share"]);
console.log("✓ primary actions = Snap/Scan/Upload/Share");

assertMvpInputAuthAllowsAnonymousCapture();
assert.equal(MVP_INPUT_AUTH_POLICY.require_signup_before_capture, false);
assert.equal(MVP_INPUT_AUTH_POLICY.anonymous_care_workspace_allowed, true);
assert.ok(/valuable enough that losing it matters/i.test(MVP_INPUT_AUTH_POLICY.auth_trigger));
console.log("✓ auth does not gate capture; anonymous workspace allowed");

assert.ok(/understands? the situation better/i.test(MVP_INPUT_SUCCESS_METRIC));
assert.ok(/person you care for/i.test(MVP_INPUT_STARTING_QUESTION_FEEL));
console.log("✓ success metric + starting question feel");

assert.ok(/No signup|no signup|First action/i.test(ADOPTION_WEDGE_DEFINING_PRINCIPLE));
console.log("✓ adoption wedge aligns (first action = first value)");

assertEntryMethodDoesNotBranchReasoning(false);
console.log("✓ entry methods do not branch reasoning");

{
  const sot = path.join(root, "docs/02-product/solenos-mvp-input-experience.md");
  assert.ok(fs.existsSync(sot));
  const body = fs.readFileSync(sot, "utf8");
  assert.ok(/No authentication initially/i.test(body));
  assert.ok(/Snap/i.test(body) && /Scan/i.test(body));
  assert.ok(/understand the situation better/i.test(body));
  const rule = path.join(root, ".cursor/rules/solenos-mvp-input-experience.mdc");
  assert.ok(fs.existsSync(rule));
  console.log("✓ SoT + Cursor rule");
}

{
  const panel = fs.readFileSync(
    path.join(root, "src/components/mvp-workspace/AddSituationPanel.tsx"),
    "utf8",
  );
  assert.ok(/SnapCameraCapture/.test(panel));
  assert.ok(/ScanDocumentCapture/.test(panel));
  assert.ok(/Upload/.test(panel));
  assert.ok(/Share/.test(panel) || /shareHint/.test(panel));
  assert.ok(/What is happening right now|What changed/i.test(panel));
  // Must not force account before submit
  assert.ok(!/must.?sign.?up|requireLogin|loginRequired/i.test(panel));
  console.log("✓ AddSituationPanel: Snap/Scan/Upload/Share; no login gate");
}

{
  const start = fs.readFileSync(
    path.join(root, "src/app/start/page.tsx"),
    "utf8",
  );
  assert.ok(!/requireAuth|mustLogin|sign.?up.?to.?begin/i.test(start));
  const landing = fs.readFileSync(path.join(root, "src/app/page.tsx"), "utf8");
  assert.ok(/Enter SolenOS|href=\"\/start\"/i.test(landing));
  assert.ok(!/redirect.*\/login|requireAuth\(/.test(landing));
  const workspace = fs.readFileSync(path.join(root, "src/app/workspace/page.tsx"), "utf8");
  assert.ok(/CognitiveWorkspace|enter=1|ENTER_CARE/i.test(workspace));
  assert.ok(!/redirect.*\/login|requireAuth\(/.test(workspace));
  console.log("✓ start/landing/workspace do not auth-gate Begin/capture");
}

{
  // Continuity signup exists as soft prompt later — must not be the entry gate
  const continuity = fs.readFileSync(
    path.join(root, "src/lib/identity-continuity/rehydration.ts"),
    "utf8",
  );
  assert.ok(/NOT auth gate|not auth gate|state restoration/i.test(continuity));
  console.log("✓ identity continuity: login restores — not entry wall");
}

console.log("\n=== MVP Input Experience: all checks passed ===\n");
