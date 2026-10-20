/**
 * Care Reality Engine Principles — frozen MVP behavioral contract.
 * SoT: docs/02-product/solenos-care-reality-engine-principles.md
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  CARE_REALITY_ENGINE_PRINCIPLES_PURPOSE,
  CARE_REALITY_ENGINE_PRINCIPLES,
  CARE_REALITY_UNIVERSAL_ACTIONS,
  CARE_REALITY_REASONING_ORDER,
  CARE_REALITY_EPISTEMIC_LAYERS,
  CARE_REALITY_CONFIDENCE_BANDS,
  CARE_REALITY_PRINCIPLE_MODULES,
  CARE_RECORD_SCOPE_RULE,
  CARE_RECORD_MODE,
  CARE_REALITY_IMPACT_QUESTION,
  CARE_REALITY_FEATURE_FILTER,
  containsChatbotPersonality,
  containsCausalTheater,
} from "../src/lib/care-reality-engine-principles";
import { classifyCareMemoryState } from "../src/lib/care-memory-maturity";

const root = process.cwd();

console.log("=== Care Reality Engine Principles ===\n");
console.log(CARE_REALITY_ENGINE_PRINCIPLES_PURPOSE);

assert.equal(CARE_REALITY_ENGINE_PRINCIPLES.length, 11);
assert.ok(CARE_REALITY_ENGINE_PRINCIPLES.includes("preserve_uncertainty"));
assert.ok(CARE_REALITY_ENGINE_PRINCIPLES.includes("new_vs_existing_care_record"));
assert.ok(CARE_REALITY_UNIVERSAL_ACTIONS.length >= 8);
assert.equal(CARE_REALITY_REASONING_ORDER[0], "classify_new_or_existing_care_record");
assert.ok(CARE_REALITY_REASONING_ORDER.includes("update_living_care_record"));
assert.deepEqual([...CARE_REALITY_EPISTEMIC_LAYERS], [
  "observations",
  "interpretations",
  "confirmed_facts",
  "unknowns",
]);
assert.deepEqual([...CARE_REALITY_CONFIDENCE_BANDS], ["low", "medium", "high"]);
assert.ok(/care recipient Care Record/i.test(CARE_RECORD_SCOPE_RULE));
assert.ok(/Do not invent history/i.test(CARE_RECORD_MODE.new_care_record));
assert.ok(/Compare before respond/i.test(CARE_RECORD_MODE.existing_care_record));
assert.ok(/change the person's care reality/i.test(CARE_REALITY_IMPACT_QUESTION));
assert.ok(/Care Reality Engine/i.test(CARE_REALITY_FEATURE_FILTER));
console.log("✓ frozen principle catalog + reasoning order");

assert.ok(containsChatbotPersonality("I'm sorry to hear that."));
assert.ok(containsChatbotPersonality("I understand how you feel."));
assert.ok(!containsChatbotPersonality("Walking difficulty was reported after a fall."));
assert.ok(containsCausalTheater("The medication caused the dizziness."));
assert.ok(containsCausalTheater("The fall caused the walking difficulty."));
assert.ok(
  !containsCausalTheater(
    "Dizziness was reported after a medication change. The relationship is currently unclear.",
  ),
);
console.log("✓ chatbot + causal theater detectors");

assert.equal(classifyCareMemoryState({ observationCount: 1 }), "new_care_reality");
assert.equal(classifyCareMemoryState({ observationCount: 3 }), "returning_care_reality");
console.log("✓ new vs existing care record classification available");

{
  for (const principle of CARE_REALITY_ENGINE_PRINCIPLES) {
    const mods = CARE_REALITY_PRINCIPLE_MODULES[principle];
    assert.ok(mods?.length, `missing module map for ${principle}`);
    for (const mod of mods) {
      if (mod.startsWith("docs/")) {
        assert.ok(fs.existsSync(path.join(root, mod)), `missing doc ${mod}`);
      } else {
        const asFile = path.join(root, mod);
        const asIndex = path.join(root, mod, "index.ts");
        assert.ok(
          fs.existsSync(asFile) || fs.existsSync(asIndex),
          `missing module path for ${principle}: ${mod}`,
        );
      }
    }
  }
  console.log("✓ each principle maps to existing module/doc");
}

{
  const sot = path.join(
    root,
    "docs/02-product/solenos-care-reality-engine-principles.md",
  );
  assert.ok(fs.existsSync(sot));
  const body = fs.readFileSync(sot, "utf8");
  assert.ok(/Frozen for MVP/i.test(body));
  assert.ok(/Never overwrite history/i.test(body));
  assert.ok(/New vs existing/i.test(body));
  assert.ok(/illustrations only/i.test(body));
  const rule = path.join(
    root,
    ".cursor/rules/solenos-care-reality-engine-principles.mdc",
  );
  assert.ok(fs.existsSync(rule));
  const mod = fs.readFileSync(
    path.join(root, "src/lib/care-reality-engine-principles/index.ts"),
    "utf8",
  );
  assert.ok(!/\bJennifer\b/.test(mod));
  assert.ok(!/if.*includes\(["']fall["']\)/i.test(mod));
  console.log("✓ SoT + rule + no scenario hardcoding in module");
}

console.log("\n=== Care Reality Engine Principles: all checks passed ===\n");
