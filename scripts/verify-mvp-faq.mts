/**
 * MVP FAQ — home excerpt + full Help; expectations without onboarding wall.
 * SoT: docs/02-product/solenos-mvp-faq.md
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  CURRENT_CAPABILITIES,
  getFullFaqItems,
  getHomeFaqItems,
  HOME_FAQ_IDS,
  MVP_FAQ_ITEMS,
  MVP_FAQ_PHILOSOPHY,
  MVP_FAQ_PURPOSE,
  GLOBAL_FEEDBACK_LABEL,
} from "../src/lib/mvp-faq";
import { GREETING_ORIENTATION, SESSION_REENTRY_GREETING_PATTERNS } from "../src/lib/entry-behavior-protocol";

const root = process.cwd();

console.log("=== SolenOS MVP FAQ ===\n");
console.log(MVP_FAQ_PURPOSE);

assert.ok(MVP_FAQ_PHILOSOPHY.includes("preserve what matters"));
assert.equal(HOME_FAQ_IDS.length, 7);
assert.ok(HOME_FAQ_IDS.includes("what-is-solenos"));
assert.ok(HOME_FAQ_IDS.includes("is-free"));
assert.ok(HOME_FAQ_IDS.includes("can-misunderstand"));

const home = getHomeFaqItems();
assert.equal(home.length, 7);
assert.ok(getFullFaqItems().length >= 30);
assert.ok(MVP_FAQ_ITEMS.some((i) => i.id === "how-thinks"));
assert.ok(MVP_FAQ_ITEMS.some((i) => i.id === "vs-chatbot"));
assert.ok(MVP_FAQ_ITEMS.some((i) => i.id === "emergency"));
assert.ok(!/free forever/i.test(JSON.stringify(MVP_FAQ_ITEMS)));
assert.ok(CURRENT_CAPABILITIES.worksWell.items.length >= 3);
assert.ok(CURRENT_CAPABILITIES.stillImproving.items.length >= 3);
assert.ok(GLOBAL_FEEDBACK_LABEL.includes("improve"));
console.log("✓ FAQ content contracts");

assert.ok(GREETING_ORIENTATION.newUser.includes("caring for"));
assert.ok(GREETING_ORIENTATION.returning.includes("Care Record"));
assert.ok(GREETING_ORIENTATION.howAreYou.includes("organize care information"));
assert.ok(
  SESSION_REENTRY_GREETING_PATTERNS.some((p) => p.test("How are you?")),
  "how are you classified as greeting",
);
assert.ok(
  GREETING_ORIENTATION.forbiddenPhrases.some((p) => /always here for you/i.test(p)),
);
console.log("✓ greeting orientation (not companion chat)");

{
  const sot = path.join(root, "docs/02-product/solenos-mvp-faq.md");
  assert.ok(fs.existsSync(sot));
  const retention = path.join(root, "docs/02-product/solenos-mvp-retention-behavior.md");
  assert.ok(fs.existsSync(retention));
  const rule = path.join(root, ".cursor/rules/solenos-mvp-faq.mdc");
  assert.ok(fs.existsSync(rule));

  const welcome = fs.readFileSync(
    path.join(root, "src/components/public/WelcomeTrustStack.tsx"),
    "utf8",
  );
  assert.ok(welcome.includes("getHomeFaqItems"));
  assert.ok(welcome.includes("FaqList"));

  const support = fs.readFileSync(path.join(root, "src/app/support/page.tsx"), "utf8");
  assert.ok(support.includes("getFullFaqItems"));
  assert.ok(support.includes('id="faq"'));

  assert.ok(fs.existsSync(path.join(root, "src/app/capabilities/page.tsx")));

  const workspace = fs.readFileSync(
    path.join(root, "src/components/mvp-workspace/CognitiveWorkspace.tsx"),
    "utf8",
  );
  assert.ok(workspace.includes("HelpImproveSolenos"));

  const addPanel = fs.readFileSync(
    path.join(root, "src/components/mvp-workspace/AddSituationPanel.tsx"),
    "utf8",
  );
  assert.ok(addPanel.includes("Help SolenOS understand the current care situation"));
  console.log("✓ SoT + UI wiring");
}

console.log("\n=== MVP FAQ: all checks passed ===\n");
