/**
 * Visual Language — Care Reality cards, not chatbot chrome.
 * SoT: docs/02-product/solenos-visual-language.md
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  CARE_REALITY_COLORS,
  VISUAL_LANGUAGE_FORBIDDEN,
  VISUAL_LANGUAGE_PURPOSE,
  VISUAL_LANGUAGE_REQUIRED_SURFACES,
} from "../src/lib/visual-language";

const root = process.cwd();

console.log("=== Visual Language: Care Reality, Not Chat ===\n");
console.log(VISUAL_LANGUAGE_PURPOSE);

assert.equal(CARE_REALITY_COLORS.caregiverBg.toLowerCase(), "#f3efe7");
assert.equal(CARE_REALITY_COLORS.accent.toLowerCase(), "#52796f");
assert.equal(CARE_REALITY_COLORS.understandingBg.toLowerCase(), "#ffffff");
console.log("✓ color tokens");

assert.ok(VISUAL_LANGUAGE_FORBIDDEN.includes("chat_bubbles"));
assert.ok(VISUAL_LANGUAGE_REQUIRED_SURFACES.includes("fab_tell_us_what_happened"));
console.log("✓ forbidden / required surfaces");

const css = fs.readFileSync(path.join(root, "src", "app", "globals.css"), "utf8");
assert(css.includes("--care-note-bg"));
assert(css.includes("--care-accent"));
assert(css.includes("--care-unknowns-bg"));
assert(css.includes(".care-card-understanding"));
assert(css.includes(".care-card-note"));
assert(css.includes(".care-card-unknowns"));
assert(css.includes(".care-reality-fab"));
assert(!css.includes("chat-bubble") && !css.includes("message-bubble"));
console.log("✓ CSS care cards + FAB present; no chat-bubble classes");

const panel = fs.readFileSync(
  path.join(root, "src", "components", "mvp-workspace", "LivingCareRecordPanel.tsx"),
  "utf8",
);
assert(panel.includes("What is understood about this situation"));
assert(panel.includes("What changed"));
assert(panel.includes("Still unclear"));
assert(panel.includes("care-card-understanding"));
assert(panel.includes("care-card-unknowns"));
assert(!panel.toLowerCase().includes("ask me anything"));
console.log("✓ LCR panel orientation labels + care cards");

const workspace = fs.readFileSync(
  path.join(root, "src", "components", "mvp-workspace", "CognitiveWorkspace.tsx"),
  "utf8",
);
assert(workspace.includes("care-card-note"));
assert(workspace.includes("Tell us what happened"));
assert(workspace.includes("care-reality-fab"));
console.log("✓ caregiver note card + FAB");

const sot = fs.readFileSync(
  path.join(root, "docs", "02-product", "solenos-visual-language.md"),
  "utf8",
);
assert(/chatbot/i.test(sot));
assert(/living care record/i.test(sot));
assert(/mobile/i.test(sot));
console.log("✓ SoT present");

console.log("\nAll visual-language checks passed.");
