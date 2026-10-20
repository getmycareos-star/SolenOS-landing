/**
 * Response Contract — orientation fields, never-say, no hardcoded scenario templates.
 * SoT: docs/02-product/solenos-response-contract.md
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  RESPONSE_CONTRACT_PURPOSE,
  RESPONSE_CONTRACT_FIELDS,
  RESPONSE_CONTRACT_PIPELINE,
  RESPONSE_CONTRACT_NEVER_SAY,
  RESPONSE_CONTRACT_NOT,
  buildResponseContractOutput,
  assertNoResponseContractNeverSay,
  assertNoHardcodedScenarioBranch,
  containsResponseContractNeverSay,
} from "../src/lib/response-contract";
import { buildResponseIntelligenceOutput } from "../src/lib/response-intelligence";

const root = process.cwd();

console.log("=== Response Contract ===\n");
console.log(RESPONSE_CONTRACT_PURPOSE);

assert.ok(RESPONSE_CONTRACT_NOT.includes("ai_chatbot"));
assert.ok(RESPONSE_CONTRACT_NOT.includes("document_summarizer"));
assert.ok(RESPONSE_CONTRACT_NOT.includes("medical_advice_engine"));
console.log("✓ not chatbot / summarizer / advice engine");

assert.deepEqual(
  [...RESPONSE_CONTRACT_FIELDS],
  [
    "what_is_happening",
    "what_matters_now",
    "what_to_ask_next",
    "risk_level",
    "what_can_wait",
    "follow_up_items",
  ],
);
assert.deepEqual(
  [...RESPONSE_CONTRACT_PIPELINE],
  [
    "input",
    "evidence_understanding",
    "care_reality_update",
    "situation_relationship_engine",
    "response_contract",
  ],
);
console.log("✓ field order + pipeline");

{
  const out = buildResponseContractOutput({
    what_is_happening: "Sleep changed after the hospital visit; reason unclear.",
    what_matters_now: "Whether the sleep change continues.",
    what_to_ask_next: "Do you know why the medication was changed?",
    what_can_wait: "Older paperwork until the recent change is clearer.",
    follow_up_items: ["Notice whether the sleep pattern holds"],
    risk_level: "medium",
  });
  assert.equal(out.risk_level, "medium");
  assert.equal(typeof out.what_to_ask_next, "string");
  assertNoResponseContractNeverSay(Object.values(out).flatMap((v) => (Array.isArray(v) ? v : [v])));
  console.log("✓ buildResponseContractOutput from understanding");
}

assert.equal(containsResponseContractNeverSay("I extracted 8 medications."), true);
assert.equal(containsResponseContractNeverSay("I'm here for you."), true);
assert.equal(containsResponseContractNeverSay("Based on my analysis, …"), true);
assert.equal(
  containsResponseContractNeverSay("Held in the Living Care Record. Sleep pattern changed."),
  false,
);
console.log("✓ never-say bans");

assertNoHardcodedScenarioBranch(false);
console.log("✓ no hardcoded scenario branch guard");

{
  const out = buildResponseIntelligenceOutput({
    what_is_happening: "Appetite dropped after the clinic visit.",
    what_matters_now: "Whether eating stays low.",
    what_to_ask_next: ["Was a new medication started?"],
    what_can_wait: "Sorting older mail.",
    follow_up_items: ["Watch meals over the next days"],
    has_meaningful_change: true,
    has_open_unknowns: true,
  });
  assert.equal(out.risk_level, "medium");
  console.log("✓ response-intelligence uses Response Contract builder");
}

{
  const {
    humanAttentionLabelFor,
    shouldDiscloseAttentionLevel,
    containsAttentionScoreTheater,
    ATTENTION_LABELS_BY_RISK,
  } = await import("../src/lib/response-intelligence");
  assert.equal(ATTENTION_LABELS_BY_RISK.low.includes("Can wait"), true);
  assert.equal(ATTENTION_LABELS_BY_RISK.high.includes("Needs attention"), true);
  assert.ok(!containsAttentionScoreTheater(humanAttentionLabelFor("medium")));
  assert.equal(
    shouldDiscloseAttentionLevel({ risk: "low", disclosureStage: "early" }),
    false,
    "low attention quiet on early capture",
  );
  assert.equal(
    shouldDiscloseAttentionLevel({ risk: "medium", disclosureStage: "early" }),
    true,
    "medium attention discloses even early",
  );
  assert.equal(
    shouldDiscloseAttentionLevel({ risk: "high", disclosureStage: "early" }),
    true,
  );
  console.log("✓ risk_level → human attention (no scores) + disclosure gate");
}

const sot = fs.readFileSync(
  path.join(root, "docs", "02-product", "solenos-response-contract.md"),
  "utf8",
);
assert(sot.includes("Never Hardcode Examples") || sot.includes("Never hardcode examples"));
assert(sot.includes("What is happening"));
assert(sot.includes("Follow-up"));
assert(sot.includes("Voice") || sot.includes("voice"));
console.log("✓ SoT present");

const composer = fs.readFileSync(
  path.join(root, "src", "lib", "caregiver-response-composer", "index.ts"),
  "utf8",
);
for (const phrase of ["i extracted", "based on my analysis", "i'm here for you", "i recommend"]) {
  assert(
    composer.toLowerCase().includes(phrase),
    `composer bans must include ${phrase}`,
  );
}
console.log("✓ composer includes Response Contract never-say bans");

// Production composers must not ship phrase→response if-branches for design scenarios
const bannedTemplatePatterns = [
  /if\s*\(.*\bfell?\b.*\)\s*\{[^}]*hit their head/i,
  /if\s*\(.*\bwander/i,
  /FALL_RESPONSE_TEMPLATE/,
  /cannedFallResponse/,
];
const composerDir = path.join(root, "src", "lib", "caregiver-response-composer");
const composerFiles = fs.readdirSync(composerDir).filter((f) => f.endsWith(".ts"));
for (const file of composerFiles) {
  const src = fs.readFileSync(path.join(composerDir, file), "utf8");
  for (const pat of bannedTemplatePatterns) {
    assert(!pat.test(src), `hardcoded scenario template in ${file}`);
  }
}
console.log("✓ no canned fall/wander templates in composer");

for (const p of RESPONSE_CONTRACT_NEVER_SAY) {
  assert(typeof p === "string" && p.length > 0);
}
console.log("✓ never-say list non-empty");

console.log("\nAll response-contract checks passed.");
