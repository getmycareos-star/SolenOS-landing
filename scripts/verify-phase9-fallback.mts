/**
 * Phase 9 — Reliability and Fallback Behavior verification.
 *
 * Tests:
 * 1. Understanding failures do not crash the pipeline.
 * 2. Original input is never lost.
 * 3. Invalid understanding output cannot continue downstream.
 * 4. Fallback path preserves uncertainty.
 * 5. The response system does not receive fabricated understanding objects.
 */

import assert from "node:assert/strict";
import {
  buildCareSituationUnderstanding,
  buildCareSituationUnderstandingFromExtraction,
  assertUnderstandingValid,
  acceptCareSituationUnderstanding,
} from "../src/lib/care-situation-understanding";
import {
  resetActiveCareSituationStore,
} from "../src/lib/active-care-situation";
import { resetCareRealityStateStore } from "../src/lib/care-reality-state";
import { resetMultiCaregiverContextStore } from "../src/lib/multi-caregiver-context-model";
import { resetCareEpistemicsStores } from "../src/lib/care-epistemics";
import { resetCareRecipientIdentityStore } from "../src/lib/care-recipient-identity";
import { resetDecisionMemoryStore } from "../src/lib/decision-memory";
import { projectCareSituationOrientation } from "../src/lib/care-situation-understanding";
import { projectCareSituationToResponseContract } from "../src/lib/caregiver-response-composer/project-to-response-contract";

function resetAll() {
  resetActiveCareSituationStore();
  resetCareRealityStateStore();
  resetMultiCaregiverContextStore();
  resetCareEpistemicsStores();
  resetCareRecipientIdentityStore();
  resetDecisionMemoryStore();
}

async function main() {
  console.log("=== Phase 9 — Reliability and Fallback Behavior ===\n");

  // 1. Async fallback — empty/garbled input must not crash
  {
    resetAll();
    const fallbackAsync = await buildCareSituationUnderstanding({
      rawText: "asdf qwerty zxcv",
      contributorId: "phase9_fallback_async",
    });
    assert.ok(!fallbackAsync.can_orient, "async fallback must not orient");
    assert.equal(fallbackAsync.confidence, "low");
    assert.equal(fallbackAsync.instant_path, true);
    assert.ok(
      fallbackAsync.facts.some((f) => f.text === "asdf qwerty zxcv"),
      "async fallback must preserve raw text as fact",
    );
    assert.ok(fallbackAsync.unknowns.length > 0, "async fallback must preserve unknowns");
    assert.ok(
      fallbackAsync.follow_up_questions.length > 0,
      "async fallback must request minimal clarification",
    );

    const validation = assertUnderstandingValid(fallbackAsync);
    assert.ok(
      validation.ok,
      `async fallback invalid: ${validation.failures.join(", ")}`,
    );

    // Projection must not crash on fallback
    const orientation = projectCareSituationOrientation(fallbackAsync);
    assert.ok(orientation.what_is_happening.length > 0, "orientation must not be empty");

    const contract = projectCareSituationToResponseContract(fallbackAsync);
    assert.ok(contract.what_is_happening.length > 0, "contract must not be empty");
    assert.equal(contract.risk_level, "low", "fallback risk must be low");

    console.log("✓ Async fallback — garbled input preserved, no crash, projection safe");
  }

  // 2. Sync fallback — buildCareSituationUnderstandingFromExtraction crash safety
  {
    resetAll();
    const fallbackSync = buildCareSituationUnderstandingFromExtraction({
      rawText: "asdf qwerty zxcv",
      contributorId: "phase9_fallback_sync",
    });
    assert.ok(!fallbackSync.can_orient, "sync fallback must not orient");
    assert.equal(fallbackSync.confidence, "low");
    assert.equal(fallbackSync.instant_path, true);
    assert.ok(
      fallbackSync.facts.some((f) => f.text === "asdf qwerty zxcv"),
      "sync fallback must preserve raw text as fact",
    );
    assert.ok(fallbackSync.unknowns.length > 0, "sync fallback must preserve unknowns");

    const validation = assertUnderstandingValid(fallbackSync);
    assert.ok(
      validation.ok,
      `sync fallback invalid: ${validation.failures.join(", ")}`,
    );

    console.log("✓ Sync fallback — garbled input preserved, no crash");
  }

  // 3. Extremely short input must not crash or invent facts
  {
    resetAll();
    const shortAsync = await buildCareSituationUnderstanding({
      rawText: "hi",
      contributorId: "phase9_fallback_short",
    });
    assert.ok(!shortAsync.can_orient, "short input fallback must not orient");
    assert.equal(shortAsync.confidence, "low");
    assert.equal(shortAsync.instant_path, true);
    assert.ok(shortAsync.facts.length === 0, "short input must not invent facts");

    const validation = assertUnderstandingValid(shortAsync);
    assert.ok(
      validation.ok,
      `short input fallback invalid: ${validation.failures.join(", ")}`,
    );

    console.log("✓ Short input fallback — no crash, no invented facts");
  }

  // 4. Original input is preserved through fallback
  {
    resetAll();
    const originalInput = "asdf qwerty zxcv";
    const fallback = await buildCareSituationUnderstanding({
      rawText: originalInput,
      contributorId: "phase9_preserve_input",
    });
    assert.ok(
      fallback.facts.some((f) => f.text === originalInput),
      "original input must be preserved as fact in fallback",
    );
    assert.ok(!fallback.can_orient, "fallback must not orient when extraction is empty");

    console.log("✓ Original input preserved through fallback");
  }

  // 5. Successful understanding path still works
  {
    resetAll();
    const golden = `Mom fell again this morning but she says she's fine. Her walking has been getting worse.`;
    const u = await buildCareSituationUnderstanding({
      rawText: golden,
      contributorId: "phase9_success",
    });
    assert.ok(u.can_orient || u.facts.length > 0, "successful path must still orient or have facts");
    assert.ok(u.facts.length > 0, "successful path must extract facts");

    const accepted = acceptCareSituationUnderstanding(u);
    assert.ok(accepted.ok, `successful path failed acceptance: ${accepted.reasons.join(", ")}`);

    console.log("✓ Successful understanding path unaffected");
  }

  // 6. Fallback never produces fabricated objects
  {
    resetAll();
    const u = await buildCareSituationUnderstanding({
      rawText: "xyzzy",
      contributorId: "phase9_no_fabrication",
    });
    // No invented medication, diagnosis, causation, etc.
    const blob = [
      ...u.facts.map((f) => f.text),
      ...u.interpretations.map((i) => i.text),
      ...u.unknowns,
      ...u.follow_up_questions,
    ]
      .filter(Boolean)
      .join(" ");

    assert.ok(!/\b(?:medication|medicine|diagnos|treatment|caused|fell|hospital)\b/i.test(blob), {
      message: "fallback must not invent care facts",
      actual: blob,
    });

    console.log("✓ Fallback produces no fabricated objects");
  }

  console.log("\nverify:phase9-fallback OK");
}

main().catch((err) => {
  console.error("verify:phase9-fallback FAILED", err);
  process.exit(1);
});
