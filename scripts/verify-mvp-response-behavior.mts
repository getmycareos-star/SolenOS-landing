/**
 * MVP Response Behavior — Care Reality Object + no example hardcoding.
 * SoT: docs/02-product/solenos-mvp-response-behavior.md
 * Examples: docs/02-product/solenos-mvp-reasoning-examples.md (evaluation only)
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  MVP_RESPONSE_BEHAVIOR_PURPOSE,
  MVP_RESPONSE_PIPELINE,
  EXAMPLE_MUST_NOT_BE_PRODUCT_BRANCHES,
  MVP_BEHAVIOR_HARD_NEVER,
  buildCareRealityObject,
  evaluateCareRealityReasoning,
} from "../src/lib/mvp-response-behavior";
import {
  ingestActiveCareObservation,
  resetActiveCareSituationStore,
} from "../src/lib/active-care-situation";
import { resetCareRealityStateStore } from "../src/lib/care-reality-state";
import { composeCaregiverResponse } from "../src/lib/caregiver-response-composer";
import { classifyCareEventKind } from "../src/lib/living-care-record-ux";
import { resetMultiCaregiverContextStore } from "../src/lib/multi-caregiver-context-model";
import { resetCareEpistemicsStores } from "../src/lib/care-epistemics";
import { resetCareRecipientIdentityStore } from "../src/lib/care-recipient-identity";
import { resetDecisionMemoryStore } from "../src/lib/decision-memory";

const root = process.cwd();

function resetAll() {
  resetActiveCareSituationStore();
  resetCareRealityStateStore();
  resetMultiCaregiverContextStore();
  resetCareEpistemicsStores();
  resetCareRecipientIdentityStore();
  resetDecisionMemoryStore();
}

function walkTsFiles(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === "dist") continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walkTsFiles(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !name.includes(".test.")) out.push(p);
  }
  return out;
}

console.log("=== MVP Response Behavior ===\n");
console.log(MVP_RESPONSE_BEHAVIOR_PURPOSE);

assert.equal(MVP_RESPONSE_PIPELINE.length, 6);
assert.ok(MVP_RESPONSE_PIPELINE.includes("identify_change"));
assert.ok(MVP_RESPONSE_PIPELINE.includes("identify_unknowns"));
console.log("✓ six-step pipeline contract");

{
  const sot = path.join(root, "docs/02-product/solenos-mvp-response-behavior.md");
  const examples = path.join(root, "docs/02-product/solenos-mvp-reasoning-examples.md");
  const guidelines = path.join(
    root,
    "docs/10-ai-systems/solenos-reasoning-guidelines.md",
  );
  assert.ok(fs.existsSync(sot));
  assert.ok(fs.existsSync(examples));
  assert.ok(fs.existsSync(guidelines));
  const examplesBody = fs.readFileSync(examples, "utf8");
  assert.ok(/EVALUATION ONLY|NOT product logic|Do NOT create/i.test(examplesBody));
  assert.ok(/keyword matching/i.test(examplesBody));
  assert.ok(!/if user mentions fall/i.test(examplesBody) || /Wrong:|Do NOT/i.test(examplesBody));
  console.log("✓ SoT + evaluation examples + AI guidelines (docs only)");
}

{
  // Production src must not hardcode illustration phrases as branch conditions
  const srcFiles = walkTsFiles(path.join(root, "src"));
  const offenders: string[] = [];
  for (const file of srcFiles) {
    if (file.includes(`${path.sep}mvp-response-behavior${path.sep}`)) continue;
    const body = fs.readFileSync(file, "utf8");
    for (const phrase of EXAMPLE_MUST_NOT_BE_PRODUCT_BRANCHES) {
      if (!body.toLowerCase().includes(phrase.toLowerCase())) continue;
      // Allow comments that say "never hardcode" / illustration
      const idx = body.toLowerCase().indexOf(phrase.toLowerCase());
      const window = body.slice(Math.max(0, idx - 80), idx + phrase.length + 80);
      if (/illustration|evaluation|never|must not|example only/i.test(window)) continue;
      offenders.push(`${path.relative(root, file)}: ${phrase}`);
    }
  }
  assert.equal(
    offenders.length,
    0,
    `Illustration phrases must not be product branches:\n${offenders.join("\n")}`,
  );
  console.log("✓ no illustration phrases as product branches in src/");
}

{
  // Novel paraphrases — NEVER the exact doc example sentences as fixtures for templates
  const novelInputs = [
    "Lately in the evenings he keeps looking for someone who is no longer alive, and it upsets him.",
    "After the hospital stay the new med instructions don't match the list still taped on the fridge.",
    "One sibling says living alone is fine; another thinks safety is no longer there.",
    "Two urgent visits this month after episodes of not knowing where she was.",
    "Job, children, and his care all sit on me — nothing feels shared.",
    "She moved freely on her own months ago; after the tumble she wants someone close.",
    "He prepared dinner daily before; now meals get skipped and plates sit out.",
    "Last year we chose home over a residence because she was managing; wondering if that still holds.",
    "Clinician wants more walking; he says he cannot and won't try.",
    "Since the new pill began she seems more worn out — timing unclear if related.",
    "After the move she gets lost in rooms that should be familiar.",
    "When relatives drop by briefly they think everything is okay; daily life looks different.",
  ];

  for (const text of novelInputs) {
    const object = buildCareRealityObject({ rawText: text });
    const evalResult = evaluateCareRealityReasoning({ rawText: text, object });
    assert.ok(
      evalResult.passed,
      `Novel input failed structural reasoning:\n${text}\n${evalResult.failures.join("; ")}`,
    );
  }
  console.log("✓ novel paraphrases produce Care Reality Object structure");
}

{
  resetAll();
  // Unseen situation — not in the example list
  const text =
    "The home nurse noted blood pressure swings after the weekend trip, and nobody wrote down what she ate.";
  const turn = ingestActiveCareObservation({
    caregiverId: "cg_mvp_rb_novel",
    rawText: text,
    kind: classifyCareEventKind(text),
    nowIso: "2026-07-22T12:00:00.000Z",
  });
  const object = buildCareRealityObject({
    rawText: text,
    situation: turn.situation,
    careKey: "cg_mvp_rb_novel",
  });
  assert.ok(
    object.events.length + object.observations.length + object.changes_detected.length > 0,
  );
  const composed = composeCaregiverResponse({
    turn,
    latestRawText: text,
    kind: classifyCareEventKind(text),
  });
  const blob = [
    composed.recognition_line,
    composed.confirmation,
    composed.situation_summary,
    ...(composed.what_we_know ?? []),
    composed.what_matters_now,
    ...(composed.still_unclear ?? []),
  ]
    .filter(Boolean)
    .join("\n");
  for (const ban of MVP_BEHAVIOR_HARD_NEVER) {
    assert.ok(!ban.test(blob), `banned pattern in composer: ${ban}`);
  }
  assert.ok(!/here is a summary of your document/i.test(blob));
  assert.ok(!/i understand how you feel/i.test(blob));
  console.log("✓ unseen input → object + composer without hard-never failures");
}

{
  const rule = path.join(root, ".cursor/rules/solenos-mvp-response-behavior.mdc");
  assert.ok(fs.existsSync(rule));
  const mod = fs.readFileSync(
    path.join(root, "src/lib/mvp-response-behavior/index.ts"),
    "utf8",
  );
  assert.ok(!/\bJennifer\b/.test(mod));
  assert.ok(mod.includes("EVALUATION ONLY") || mod.includes("never keyword"));
  console.log("✓ Cursor rule + module has no scenario hardcoding");
}

console.log("\n=== MVP Response Behavior: all checks passed ===\n");
