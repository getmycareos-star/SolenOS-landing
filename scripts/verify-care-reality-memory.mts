/**
 * Care Reality Memory — store journey objects, not sentences.
 * SoT: docs/02-product/solenos-care-reality-memory.md
 *
 * Illustration fixtures only — never product if-branches.
 */
import "./_verify-env.mts";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CARE_REALITY_MEMORY_PURPOSE,
  ingestCareRealityMemoryFromCapture,
  listCareRealityMemory,
  summarizeCareRealityMemory,
  centersArgumentAsCareMemory,
  containsTextMemoryTheater,
  isTextRecurrenceOnly,
  detectRealityRecurrence,
  resetCareRealityMemoryStore,
  memoryPriorityForType,
} from "../src/lib/care-reality-intelligence";
import { resetMultiCaregiverContextStore } from "../src/lib/multi-caregiver-context-model";
import { resolveCareRealityStoreKey } from "../src/lib/multi-caregiver-context-model";

console.log("=== Care Reality Memory ===\n");
console.log(CARE_REALITY_MEMORY_PURPOSE);

const sot = readFileSync(
  join(process.cwd(), "docs/02-product/solenos-care-reality-memory.md"),
  "utf8",
);
assert.ok(/Store Reality, Not Text|care reality/i.test(sot));
assert.ok(/Reality recurrence vs Text/i.test(sot));
assert.ok(/Never store/i.test(sot));
assert.equal(memoryPriorityForType("observation"), 1);
assert.equal(memoryPriorityForType("contributor_context"), 5);
console.log("✓ SoT + priority order");

{
  resetCareRealityMemoryStore();
  resetMultiCaregiverContextStore();

  const contributorId = "crm_mom_sleep";
  const careKey = resolveCareRealityStoreKey(contributorId);
  const dump =
    "Mom has been sleeping more since the hospital visit. My sister thinks I'm overreacting, but she only visits once a month.";

  const result = ingestCareRealityMemoryFromCapture({
    careKey,
    rawText: dump,
    subject: "Mom",
    contributorId,
    nowIso: "2026-07-20T22:00:00.000Z",
  });

  const all = listCareRealityMemory(careKey);
  assert.ok(all.length >= 2, "structured objects stored");

  assert.ok(
    all.some((o) => o.type === "event" && /hospital/i.test(o.description)),
    `hospital event — got: ${all.map((o) => `${o.type}:${o.description}`).join(" | ")}`,
  );
  assert.ok(
    all.some(
      (o) =>
        (o.type === "observation" || o.type === "change") &&
        /sleep/i.test(o.description),
    ),
    "sleep observation as care reality",
  );
  assert.ok(
    all.some((o) => o.type === "contributor_context") ||
      result.context_only.length >= 1,
    "sister disagreement held as contributor context",
  );
  assert.ok(
    all.some((o) => o.type === "relationship" || o.type === "unknown"),
    "possible relationship and/or unknown cause",
  );

  assert.ok(
    !centersArgumentAsCareMemory({ careKey }),
    "must not center family argument as primary care memory",
  );

  const summary = summarizeCareRealityMemory({ careKey, subject: "Mom" });
  assert.ok(summary.what_changed.length >= 1);
  assert.ok(
    !containsTextMemoryTheater(JSON.stringify(summary)),
    "no text-frequency theater",
  );
  assert.ok(
    !summary.what_changed.some((w) => /overreacting|sister thinks/i.test(w)),
    "opinions must not be stored as care-change facts",
  );
  console.log("✓ acceptance: hospital + sleep = reality; sister = context");
}

{
  resetCareRealityMemoryStore();
  resetMultiCaregiverContextStore();
  const careKey = resolveCareRealityStoreKey("crm_text_vs_reality");

  // Text recurrence without care domain — not a care trend
  assert.ok(
    isTextRecurrenceOnly({
      priorText: "My brother doesn't understand.",
      incomingText: "My brother doesn't understand.",
    }),
    "identical non-care chat lines = text recurrence only",
  );

  // Reality recurrence: same care domain observation
  ingestCareRealityMemoryFromCapture({
    careKey,
    rawText: "Mom has been asking the same questions repeatedly this week.",
    subject: "Mom",
    contributorId: "crm_text_vs_reality",
    nowIso: "2026-07-01T10:00:00.000Z",
  });
  const again = ingestCareRealityMemoryFromCapture({
    careKey,
    rawText: "She keeps asking the same questions again today.",
    subject: "Mom",
    contributorId: "crm_text_vs_reality",
    nowIso: "2026-07-08T10:00:00.000Z",
  });
  const recur = detectRealityRecurrence({
    careKey,
    type: "observation",
    description: "repeated questioning",
  });
  assert.ok(
    recur || again.objects.some((o) => o.recurrence_count >= 2),
    "same cognitive situation recurs as reality pattern, not sentence match",
  );
  console.log("✓ reality recurrence ≠ text recurrence");
}

console.log("\nverify:care-reality-memory OK");
