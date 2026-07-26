/**
 * Care Situation Understanding — MVP acceptance (instant value).
 *
 * Golden multi-signal paste + emotional + document-shaped fixtures.
 * Illustrations only — never product if-branches on scenario nouns.
 *
 * Instant-value gate: first capture must orient without LLM wait.
 */
import "./_verify-env.mts";
import assert from "node:assert/strict";
import {
  CARE_SITUATION_UNDERSTANDING_PURPOSE,
  INSTANT_VALUE_RULE,
  acceptCareSituationUnderstanding,
  buildCareSituationUnderstanding,
  projectCareSituationOrientation,
} from "../src/lib/care-situation-understanding";
import {
  ingestActiveCareObservation,
  resetActiveCareSituationStore,
} from "../src/lib/active-care-situation";
import { resetCareRealityStateStore } from "../src/lib/care-reality-state";
import { resetMultiCaregiverContextStore } from "../src/lib/multi-caregiver-context-model";
import { resetCareEpistemicsStores } from "../src/lib/care-epistemics";
import {
  resetCareRecipientIdentityStore,
  setCareRecipientDisplayName,
} from "../src/lib/care-recipient-identity";
import { resetDecisionMemoryStore } from "../src/lib/decision-memory";
import { resolveCareRealityStoreKey } from "../src/lib/multi-caregiver-context-model";
import { composeCaregiverResponse } from "../src/lib/caregiver-response-composer";
import { evaluateCaregiverUnderstandingTest } from "../src/lib/care-reality-intelligence/caregiver-understanding-test";
import { containsRawNoteEchoInCopy } from "../src/lib/output-quality";

console.log("=== Care Situation Understanding (instant value) ===\n");
console.log(CARE_SITUATION_UNDERSTANDING_PURPOSE);
console.log(INSTANT_VALUE_RULE);

function resetAll() {
  resetActiveCareSituationStore();
  resetCareRealityStateStore();
  resetMultiCaregiverContextStore();
  resetCareEpistemicsStores();
  resetCareRecipientIdentityStore();
  resetDecisionMemoryStore();
}

function composedBlob(composed: ReturnType<typeof composeCaregiverResponse>): string {
  return [
    composed.recognition_line ?? "",
    composed.confirmation,
    composed.situation_summary ?? "",
    composed.what_changed ?? "",
    composed.connection_note ?? "",
    composed.what_matters_now ?? "",
    composed.what_can_wait ?? "",
    ...(composed.what_we_know ?? []),
    ...(composed.still_unclear ?? []),
    ...(composed.follow_up_items ?? []),
  ].join("\n");
}

/** Multi-signal golden — evaluation fixture only. */
const MULTI_SIGNAL_GOLDEN = `Mom fell again this morning but she says she's fine. I don't know if she's just saying that because she doesn't want to worry me.

Her walking has been getting worse and she seems confused more in the evenings. The doctor changed one of her medications two weeks ago but I can't remember if this started before or after that.

My brother asked what happened but I don't even know how to explain everything because it's all mixed together.

I have her medication list somewhere, the hospital papers from last month, and messages from my sister about what she noticed.

I just feel like I'm the only person holding all these pieces.`;

async function main() {
  {
    resetAll();
    const contributorId = "csu_golden_multi";
    const careKey = resolveCareRealityStoreKey(contributorId);
    setCareRecipientDisplayName({ careKey, displayName: "Mom" });

    const started = Date.now();
    const understanding = await buildCareSituationUnderstanding({
      rawText: MULTI_SIGNAL_GOLDEN,
      contributorId,
      careKey,
      personDisplayName: "Mom",
    });
    const elapsed = Date.now() - started;

    assert.equal(understanding.instant_path, true);
    assert.ok(elapsed < 2000, `Instant path must be fast — took ${elapsed}ms`);

    const accepted = acceptCareSituationUnderstanding(understanding, {
      requireMultiSignal: true,
    });
    assert.ok(
      accepted.ok,
      `Multi-signal understanding failed:\n${accepted.reasons.join("\n")}\n` +
        JSON.stringify(
          {
            facts: understanding.facts.map((f) => f.text),
            unknowns: understanding.unknowns,
            matters_now: understanding.matters_now,
            can_wait: understanding.can_wait,
            asks: understanding.follow_up_questions,
          },
          null,
          2,
        ),
    );

    // Structural: recipient event/obs present; timing unknown preserved; admin can wait
    assert.ok(
      understanding.facts.some((f) => f.kind === "event" || f.kind === "observation"),
      "must hold recipient care facts",
    );
    assert.ok(
      understanding.unknowns.some((u) => /before or after|timing|care change/i.test(u)) ||
        understanding.follow_up_questions.some((q) =>
          /before or after|timing|care change|medication/i.test(q),
        ),
      `timing uncertainty must survive — unknowns=${understanding.unknowns.join(" | ")}`,
    );
    assert.ok(
      understanding.can_wait.length > 0 || understanding.context_only.length > 0,
      "papers / retelling / load must be can-wait or context",
    );
    assert.ok(
      understanding.possible_links.every((l) => l.causation_claimed === false),
      "never claim medication caused changes",
    );

    const turn = ingestActiveCareObservation({
      caregiverId: contributorId,
      rawText: MULTI_SIGNAL_GOLDEN,
      kind: "general",
      nowIso: "2026-07-23T16:00:00.000Z",
    });
    const composed = composeCaregiverResponse({
      turn,
      latestRawText: MULTI_SIGNAL_GOLDEN,
      kind: "general",
    });
    const blob = composedBlob(composed);

    assert.ok(
      composed.what_matters_now && composed.what_matters_now.length >= 20,
      `what_matters_now must be specific — got: ${composed.what_matters_now}`,
    );
    assert.ok(
      !/without deciding everything tonight/i.test(composed.what_matters_now ?? ""),
      "hollow matters_now rejected",
    );
    assert.ok(
      !composed.still_unclear.some((q) =>
        /has something changed with care recently/i.test(q),
      ),
      `must not ask generic recent-change when change already stated — ${composed.still_unclear.join(" | ")}`,
    );
    assert.ok(
      !containsRawNoteEchoInCopy({ blob, latestRawText: MULTI_SIGNAL_GOLDEN }),
      `must not echo raw paste — ${blob.slice(0, 400)}`,
    );

    const midnight = evaluateCaregiverUnderstandingTest({
      composed,
      latestRawText: MULTI_SIGNAL_GOLDEN,
      careRecipient: "Mom",
      isRichCareCapture: true,
      hasRecipientChanges: true,
    });
    assert.ok(
      midnight.midnight_pass,
      `midnight gate failed: ${midnight.reason} failures=${midnight.failures.join(",")}`,
    );

    console.log("✓ Multi-signal golden — understanding + compose + midnight");
  }

  {
    // Emotional / load-only — invite care reality, never therapy, never invent decline
    resetAll();
    const text =
      "I just feel like I'm drowning. Everything is on me and I don't know how much longer I can do this.";
    const u = await buildCareSituationUnderstanding({
      rawText: text,
      contributorId: "csu_emotional",
    });
    const proj = projectCareSituationOrientation(u);
    const blob = [proj.recognition_line, proj.what_is_happening, proj.what_matters_now]
      .filter(Boolean)
      .join("\n");
    assert.ok(!/i understand how you feel|i'm here for you|that sounds difficult/i.test(blob));
    assert.ok(!/declin|getting worse|progressing/i.test(blob));
    console.log("✓ Emotional / load — no therapy chatbot, no invented decline");
  }

  {
    // Document-shaped OCR text — care reality first, not extraction chrome
    resetAll();
    const docText = `DISCHARGE SUMMARY
Patient: Jane Doe
Medications changed: Donepezil increased
Follow-up: Primary care in 2 weeks
Notes: Family reports increased evening confusion since last week.`;
    const u = await buildCareSituationUnderstanding({
      rawText: docText,
      contributorId: "csu_doc",
      personDisplayName: "Jane",
    });
    const proj = projectCareSituationOrientation(u);
    const blob = [proj.what_is_happening, proj.recognition_line, ...proj.what_we_know].join("\n");
    assert.ok(!/extracted \d+|ocr|confidence %|parser/i.test(blob));
    assert.ok(u.can_orient || u.facts.length > 0 || u.unknowns.length > 0);
    console.log("✓ Document-shaped input — care reality, not extraction chrome");
  }

  {
    // Continuation — second capture reconnects (hooks exist from first)
    resetAll();
    const contributorId = "csu_continue";
    const careKey = resolveCareRealityStoreKey(contributorId);
    setCareRecipientDisplayName({ careKey, displayName: "Mom" });

    const first = await buildCareSituationUnderstanding({
      rawText: MULTI_SIGNAL_GOLDEN,
      contributorId,
      careKey,
      personDisplayName: "Mom",
    });
    assert.ok(first.continuity_hooks.length >= 1);

    ingestActiveCareObservation({
      caregiverId: contributorId,
      rawText: MULTI_SIGNAL_GOLDEN,
      kind: "general",
      nowIso: "2026-07-23T16:00:00.000Z",
    });
    const turn2 = ingestActiveCareObservation({
      caregiverId: contributorId,
      rawText: "She seems more tired today.",
      kind: "general",
      nowIso: "2026-07-24T10:00:00.000Z",
    });
    assert.ok(
      turn2.situation.observations.length >= 2,
      "second capture must attach to existing ACS",
    );
    const composed2 = composeCaregiverResponse({
      turn: turn2,
      latestRawText: "She seems more tired today.",
      kind: "general",
    });
    assert.ok(
      !/beginning of .* living care record/i.test(composed2.confirmation),
      "returning turn must not restart the care story",
    );
    console.log("✓ Continuation — second turn stays on existing care story");
  }

  console.log("\nverify:care-situation-understanding OK");
}

main().catch((err) => {
  console.error("verify:care-situation-understanding FAILED", err);
  process.exit(1);
});
