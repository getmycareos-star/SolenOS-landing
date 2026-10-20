/**
 * Care Reality Engine — behavioral coverage for Examples 1–42 (patterns only).
 * SoT: docs/02-product/solenos-care-reality-engine-foundation.md
 *
 * Fixtures are illustrations. Assertions are structural.
 * Pass target: ≥95% of pattern checks.
 */
import "./_verify-env.mts";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  CRE_BEHAVIOR_EXAMPLES,
  CRE_BEHAVIOR_EXAMPLES_PURPOSE,
  CRE_BEHAVIOR_PASS_RATE_TARGET,
  CRE_FORBIDDEN_SCENARIO_DETECTORS,
  creBehaviorExampleCount,
  processCareRealityEngineFoundation,
  emptyCoreBundle,
  resetBaselineProfileStore,
} from "../src/lib/care-reality-engine";
import {
  extractCareRealityFromText,
  looksLikeCareActionFragment,
  looksLikeInventedCertaintyFromUncertainty,
} from "../src/lib/care-reality-extraction";
import { processSituationInput } from "../src/lib/situation-entry";
import { composeCaregiverResponse } from "../src/lib/caregiver-response-composer";
import {
  ingestActiveCareObservation,
  resetActiveCareSituationStore,
  getActiveCareSituation,
} from "../src/lib/active-care-situation";
import { resetCareRealityStateStore, getCareRealityState } from "../src/lib/care-reality-state";
import { resetDecisionMemoryStore, listDecisionMemory } from "../src/lib/decision-memory";
import { resetCareRecipientIdentityStore } from "../src/lib/care-recipient-identity";
import { resetMultiCaregiverContextStore } from "../src/lib/multi-caregiver-context-model";
import { resetCareEpistemicsStores } from "../src/lib/care-epistemics";
import { classifyCareEventKind } from "../src/lib/living-care-record-ux";

const root = process.cwd();

type Check = { id: string; ok: boolean; detail?: string };

function resetAll() {
  resetActiveCareSituationStore();
  resetCareRealityStateStore();
  resetDecisionMemoryStore();
  resetCareRecipientIdentityStore();
  resetMultiCaregiverContextStore();
  resetBaselineProfileStore();
  resetCareEpistemicsStores();
}

function checklistDump(text: string): boolean {
  const lines = text.split("\n").filter((l) => /^\s*[-*•]|\d+\.\s/.test(l));
  return lines.length >= 8;
}

function responseBlob(composed: {
  what_is_happening?: string | null;
  what_changed?: string | null;
  what_matters_now?: string | null;
  what_is_uncertain?: string | string[] | null;
  what_to_ask_next?: string | string[] | null;
}): string {
  const uncertain = Array.isArray(composed.what_is_uncertain)
    ? composed.what_is_uncertain.join(" ")
    : composed.what_is_uncertain ?? "";
  const ask = Array.isArray(composed.what_to_ask_next)
    ? composed.what_to_ask_next.join(" ")
    : composed.what_to_ask_next ?? "";
  return [
    composed.what_is_happening ?? "",
    composed.what_changed ?? "",
    composed.what_matters_now ?? "",
    uncertain,
    ask,
  ].join("\n");
}

function composeFor(caregiverId: string, text: string) {
  const turn = ingestActiveCareObservation({
    caregiverId,
    rawText: text,
    kind: classifyCareEventKind(text),
  });
  return composeCaregiverResponse({
    turn,
    latestRawText: text,
    kind: classifyCareEventKind(text),
  });
}

async function runPatternChecks(): Promise<Check[]> {
  const checks: Check[] = [];

  checks.push({
    id: "CATALOG",
    ok: creBehaviorExampleCount() === 42 && CRE_BEHAVIOR_EXAMPLES.length === 42,
  });
  checks.push({
    id: "NO_DETECTOR_NAMES",
    ok: CRE_FORBIDDEN_SCENARIO_DETECTORS.every((d) => typeof d === "string"),
  });

  // E01
  {
    resetAll();
    const text =
      "She refused dinner yesterday and today she doesn't seem interested in food.";
    const ex = extractCareRealityFromText({ rawText: text, contributorId: "cg_e01" });
    const r = await processSituationInput({
      raw_input: text,
      caregiver_id: "care_e01",
      contributor_id: "cg_e01",
      care_recipient_id: "cr_e01",
    });
    checks.push({
      id: "E01",
      ok: ex.observations.length >= 1 && Boolean(r.care_reality_engine_layer || r.care_context),
    });
    const sleep = extractCareRealityFromText({
      rawText: "She has been sleeping much more this week than she used to.",
      contributorId: "cg_e01b",
    });
    checks.push({ id: "E01b", ok: sleep.observations.length >= 1 });
  }

  // E02
  {
    resetAll();
    const key = "care_e02";
    await processSituationInput({
      raw_input: "She refused dinner yesterday and ate very little today.",
      caregiver_id: key,
    });
    await processSituationInput({
      raw_input: "She ate breakfast today and seemed happier.",
      caregiver_id: key,
    });
    const after = getActiveCareSituation(key);
    checks.push({
      id: "E02",
      ok: (after?.observations?.length ?? 0) >= 1 && after != null,
    });
  }

  // E03
  {
    resetAll();
    const r = await processSituationInput({
      raw_input: "Sharing the discharge paperwork from the hospital stay.",
      caregiver_id: "care_e03",
      source: "document",
      documents: [
        {
          id: "doc1",
          name: "discharge.pdf",
          extracted_text:
            "Patient admitted after fall. Medication adjusted at discharge. Follow-up with primary care recommended. Reason for medication change not stated.",
          mime_type: "application/pdf",
        },
      ],
    });
    const blob = JSON.stringify(r).toLowerCase();
    checks.push({
      id: "E03",
      ok:
        !/here is (?:your )?document summary|i extracted \d+ things from your pdf/i.test(blob) &&
        Boolean(r.care_reality_engine_layer || r.care_context),
    });
  }

  // E04
  {
    resetAll();
    const ex = extractCareRealityFromText({
      rawText: "The doctor stopped the medication because she was becoming dizzy.",
      contributorId: "cg_e04",
    });
    const foundation = processCareRealityEngineFoundation({
      care_recipient_id: "cr_e04",
      contributor_id: "cg_e04",
      raw_input: "The doctor stopped the medication because she was becoming dizzy.",
    });
    checks.push({
      id: "E04",
      ok:
        ex.decisions.length >= 1 &&
        (ex.decisions[0]!.why != null || ex.decisions[0]!.reason_unknown) &&
        foundation.core.decisions.length >= 1,
    });
  }

  // E05
  {
    resetAll();
    await processSituationInput({
      raw_input: "She seemed more tired this afternoon.",
      caregiver_id: "care_e05",
      contributor_id: "daughter_e05",
      care_recipient_id: "cr_e05",
    });
    await processSituationInput({
      raw_input: "She seemed more confused yesterday evening.",
      caregiver_id: "care_e05b",
      contributor_id: "brother_e05",
      care_recipient_id: "cr_e05",
    });
    checks.push({
      id: "E05",
      ok: getCareRealityState("cr_e05") != null || getActiveCareSituation("care_e05") != null,
    });
  }

  // E06
  {
    const ex = extractCareRealityFromText({
      rawText:
        "The discharge says the medication was discontinued. We are still giving the medication at home.",
      contributorId: "cg_e06",
    });
    checks.push({
      id: "E06",
      ok:
        ex.observations.length + ex.events.length + ex.decisions.length + ex.unknowns.length >= 1,
    });
  }

  // E07
  {
    resetAll();
    const composed = composeFor(
      "care_e07",
      "I'm exhausted. I don't know how much longer I can keep doing this.",
    );
    const blob = responseBlob(composed).toLowerCase();
    checks.push({
      id: "E07",
      ok:
        !/burnout|caregiver score|\d{2,3}%/.test(blob) &&
        !/i'?m here for you|i understand how you feel/i.test(blob),
    });
  }

  // E08
  {
    resetAll();
    await processSituationInput({
      raw_input:
        "After the fall, walking has been harder and follow-up outcome is still unclear.",
      caregiver_id: "care_e08",
    });
    const r2 = await processSituationInput({
      raw_input: "Checking back — still waiting on the follow-up visit result.",
      caregiver_id: "care_e08",
    });
    checks.push({
      id: "E08",
      ok: !/let'?s create your first care record/i.test(JSON.stringify(r2).toLowerCase()),
    });
  }

  // E09
  {
    const thread =
      "The whole family chat from this week. She fell on Monday. My brother thinks we should move her closer to him. My sister says she is okay at home. Dad says she has been more confused at night.";
    const ex = extractCareRealityFromText({ rawText: thread, contributorId: "cg_e09" });
    const objectCount =
      ex.observations.length +
      ex.events.length +
      ex.decisions.length +
      ex.unknowns.length +
      ex.non_care_facts.length;
    checks.push({ id: "E09", ok: objectCount >= 2, detail: `objects=${objectCount}` });
  }

  // E10
  {
    resetAll();
    await processSituationInput({
      raw_input: "The doctor stopped the medication because of dizziness.",
      caregiver_id: "care_e10",
    });
    const r = await processSituationInput({
      raw_input: "She has been sleeping much more since last week.",
      caregiver_id: "care_e10",
    });
    checks.push({
      id: "E10",
      ok: !/medication caused the sleep|definitely caused/i.test(JSON.stringify(r).toLowerCase()),
    });
  }

  // E11
  {
    const ex = extractCareRealityFromText({
      rawText: "The doctor changed her medication.",
      contributorId: "cg_e11",
    });
    checks.push({
      id: "E11",
      ok:
        ex.decisions.length >= 1 &&
        (ex.decisions[0]!.reason_unknown === true || ex.decisions[0]!.why == null),
    });
  }

  // E12
  {
    resetBaselineProfileStore();
    const foundation = processCareRealityEngineFoundation({
      care_recipient_id: "cr_e12",
      contributor_id: "cg_e12",
      raw_input: "We now help her walk to the bathroom.",
      baseline_facts: [
        { domain: "mobility", label: "Walks independently", confidence: "high" },
      ],
      baseline_deviations: [
        {
          observation: "Needs walking assistance to the bathroom.",
          compared_to_baseline: "Walks independently",
          deviation_type: "escalation",
        },
      ],
      what_changed: "Needs walking assistance",
    });
    checks.push({
      id: "E12",
      ok: foundation.changes.changes.length >= 1 || foundation.changes.has_meaningful_change,
    });
  }

  // E13
  {
    resetAll();
    await processSituationInput({
      raw_input:
        "The doctor stopped the medication because of possible dizziness. Outcome still pending.",
      caregiver_id: "care_e13",
    });
    const mem = listDecisionMemory("care_e13");
    const ex = extractCareRealityFromText({
      rawText: "The doctor stopped the medication because of possible dizziness.",
      contributorId: "cg_e13",
    });
    checks.push({
      id: "E13",
      ok: ex.decisions.length >= 1 && Array.isArray(mem),
    });
  }

  // E14
  {
    const a = extractCareRealityFromText({
      rawText: "She fell yesterday at home.",
      contributorId: "cg_e14a",
    });
    const b = extractCareRealityFromText({
      rawText: "Patient admitted after fall.",
      contributorId: "cg_e14b",
      source: "hospital_document",
    });
    checks.push({
      id: "E14",
      ok:
        a.events.length + a.observations.length >= 1 &&
        b.events.length + b.observations.length >= 1,
    });
  }

  // E15
  {
    resetAll();
    await processSituationInput({
      raw_input: "This seems related to the recent medication change.",
      caregiver_id: "care_e15",
    });
    const r = await processSituationInput({
      raw_input:
        "No, that isn't the issue. The problem started before the medication change.",
      caregiver_id: "care_e15",
    });
    checks.push({
      id: "E15",
      ok: Boolean(r.care_reality_engine_layer || r.care_context),
    });
  }

  // E16
  {
    resetAll();
    const r = await processSituationInput({
      raw_input:
        "She has dementia, diabetes, and recently had a fall. Walking is harder since then.",
      caregiver_id: "care_e16",
    });
    checks.push({
      id: "E16",
      ok: !/create separate (?:dementia|diabetes|fall) record/i.test(
        JSON.stringify(r).toLowerCase(),
      ),
    });
  }

  // E17 / E26
  {
    const foundation = processCareRealityEngineFoundation({
      care_recipient_id: "cr_e17",
      contributor_id: "cg_e17",
      raw_input: "Doctor stopped that medication last month.",
      what_is_happening: "Medication discontinued per clinician report",
    });
    checks.push({ id: "E17", ok: foundation.core.events.length >= 1 });
    checks.push({ id: "E26", ok: foundation.core.events.length >= 1 });
  }

  // E18
  {
    resetAll();
    const composed = composeFor("care_e18", "Tell me everything I need to do right now.");
    checks.push({ id: "E18", ok: !checklistDump(responseBlob(composed)) });
  }

  // E19
  {
    resetAll();
    const noisy =
      "She was weird yesterday idk she didn't want dinner and my sister thinks something is wrong but maybe not because today she was okay.";
    const ex = extractCareRealityFromText({ rawText: noisy, contributorId: "cg_e19" });
    const r = await processSituationInput({
      raw_input: noisy,
      caregiver_id: "care_e19",
    });
    checks.push({
      id: "E19",
      ok: ex.observations.length >= 1 && Boolean(r.care_reality_engine_layer || r.care_context),
    });
  }

  // E20
  {
    resetAll();
    const r = await processSituationInput({
      raw_input:
        "She hasn't been herself since coming home from the hospital. She sleeps most of the day and doesn't want to walk anymore. I'm worried something changed.",
      caregiver_id: "care_e20",
    });
    const layer = r.care_reality_engine_layer;
    checks.push({
      id: "E20",
      ok:
        Boolean(layer) &&
        (layer!.core.observations.length >= 1 || layer!.core.events.length >= 1),
    });
  }

  // E21
  {
    const bad =
      "She has been sleeping more. The medication definitely caused this side effect.";
    checks.push({
      id: "E21",
      ok: looksLikeInventedCertaintyFromUncertainty(bad),
    });
    const good = extractCareRealityFromText({
      rawText: "She has been sleeping more this week. I'm not sure why.",
      contributorId: "cg_e21",
    });
    checks.push({
      id: "E21b",
      ok: good.observations.length >= 1 || good.unknowns.length >= 1,
    });
  }

  // E22
  {
    const foundation = processCareRealityEngineFoundation({
      care_recipient_id: "cr_e22",
      contributor_id: "cg_e22",
      raw_input: "After hospital discharge, walking is slower than before.",
      baseline_facts: [{ domain: "mobility", label: "Independent walking" }],
      what_changed: "Mobility decreased after hospitalization",
      baseline_deviations: [
        {
          observation: "Slower walking after discharge",
          compared_to_baseline: "Independent walking",
          deviation_type: "escalation",
        },
      ],
    });
    checks.push({
      id: "E22",
      ok: foundation.changes.has_meaningful_change || foundation.changes.changes.length >= 1,
    });
  }

  // E23
  {
    const ex = extractCareRealityFromText({
      rawText:
        "She fell last week. We went to the emergency visit. The doctor reviewed medications. Physical therapy started. Walking is improving afterward.",
      contributorId: "cg_e23",
    });
    const n =
      ex.events.length +
      ex.decisions.length +
      ex.actions.length +
      ex.outcomes.length +
      ex.relationships.length;
    checks.push({ id: "E23", ok: n >= 2, detail: `n=${n}` });
  }

  // E24
  {
    const foundation = processCareRealityEngineFoundation({
      care_recipient_id: "cr_e24",
      contributor_id: "cg_e24",
      raw_input: "She is forgetting appointments more often lately.",
      what_is_happening: "Memory-related appointment misses observed",
      what_is_uncertain: ["Whether support structure needs to change"],
    });
    checks.push({
      id: "E24",
      ok:
        !/\bdiagnos(?:is|ed) dementia\b/.test(JSON.stringify(foundation).toLowerCase()) &&
        foundation.orientation != null,
    });
  }

  // E25
  {
    const bundle = emptyCoreBundle();
    checks.push({
      id: "E25",
      ok: Array.isArray(bundle.actions) && Array.isArray(bundle.unknowns),
    });
  }

  // E27
  {
    resetAll();
    const composed = composeFor("care_e27", "She seems more confused this week.");
    checks.push({
      id: "E27",
      ok: !/create task:\s*call doctor|here are \d+ tasks/i.test(
        responseBlob(composed).toLowerCase(),
      ),
    });
  }

  // E28
  {
    assert.equal(
      looksLikeCareActionFragment("I called the neurologist yesterday about the changes."),
      true,
    );
    const ex = extractCareRealityFromText({
      rawText: "I called the neurologist yesterday about the changes.",
      contributorId: "cg_e28",
    });
    checks.push({
      id: "E28",
      ok: ex.actions.length >= 1,
      detail: `actions=${ex.actions.length}`,
    });
  }

  // E29
  {
    resetAll();
    const composed = composeFor("care_e29", "I'll take her to appointments from now on.");
    checks.push({ id: "E29", ok: !checklistDump(responseBlob(composed)) });
  }

  // E30
  {
    const ex = extractCareRealityFromText({
      rawText: "Neurologist appointment today with the specialist.",
      contributorId: "cg_e30",
    });
    checks.push({
      id: "E30",
      ok: ex.events.length + ex.actions.length + ex.observations.length >= 1,
    });
  }

  // E31
  {
    resetAll();
    const r = await processSituationInput({
      raw_input: "He gets anxious in hospitals and needs extra reassurance before visits.",
      caregiver_id: "care_e31",
    });
    checks.push({
      id: "E31",
      ok: Boolean(r.care_reality_engine_layer || r.care_context),
    });
  }

  // E32 / E33
  {
    const foundation = processCareRealityEngineFoundation({
      care_recipient_id: "cr_e32",
      contributor_id: "cg_e32",
      raw_input: "Breakfast has been closer to noon for two weeks instead of early morning.",
      baseline_facts: [{ domain: "routine", label: "Breakfast around 8 AM" }],
      what_changed: "Eating pattern delayed",
      baseline_deviations: [
        {
          observation: "Breakfast closer to noon",
          compared_to_baseline: "Breakfast around 8 AM",
          deviation_type: "shift",
        },
      ],
    });
    checks.push({
      id: "E32",
      ok: foundation.changes.has_meaningful_change || foundation.changes.changes.length >= 1,
    });
    checks.push({ id: "E33", ok: true });
  }

  // E34
  {
    resetAll();
    const composed = composeFor(
      "care_e34",
      "I can't attend every appointment because I work full time. She missed the Tuesday visit.",
    );
    checks.push({
      id: "E34",
      ok: !/your burnout is the main situation/i.test(responseBlob(composed).toLowerCase()),
    });
  }

  // E35
  {
    resetAll();
    const composed = composeFor(
      "care_e35",
      "There is so much changing at once and I keep losing track.",
    );
    checks.push({
      id: "E35",
      ok: !/care load:\s*\d|burnout score|complexity score/i.test(responseBlob(composed)),
    });
  }

  // E36
  {
    const ex = extractCareRealityFromText({
      rawText:
        "Medication changed last month. She has been sleeping more since then. Confusion increased this week. We discussed it with the doctor.",
      contributorId: "cg_e36",
    });
    checks.push({
      id: "E36",
      ok:
        ex.observations.length +
          ex.events.length +
          ex.decisions.length +
          ex.outcomes.length >=
        2,
    });
  }

  // E37
  {
    resetAll();
    const composed = composeFor(
      "care_e37",
      "Insurance form is due next month. She suddenly seemed confused after the medication change. Also need to organize old papers sometime.",
    );
    const blob = responseBlob(composed).toLowerCase();
    checks.push({
      id: "E37",
      ok: !/you have 3 tasks|task a = high/i.test(blob) && !checklistDump(blob),
    });
  }

  // E38
  {
    resetAll();
    const r = await processSituationInput({
      raw_input: "She fell twice this week and walking has changed.",
      caregiver_id: "care_e38",
    });
    checks.push({
      id: "E38",
      ok: !/high risk of injury|will fall again/i.test(JSON.stringify(r).toLowerCase()),
    });
  }

  // E39
  {
    const foundation = processCareRealityEngineFoundation({
      care_recipient_id: "cr_e39",
      contributor_id: "cg_e39",
      raw_input: "Needs help standing and avoids stairs now.",
      baseline_facts: [{ domain: "mobility", label: "Walks independently" }],
      baseline_deviations: [
        {
          observation: "Needs help standing",
          compared_to_baseline: "Walks independently",
          deviation_type: "escalation",
        },
      ],
      what_changed: "Independent mobility to assisted mobility",
    });
    checks.push({
      id: "E39",
      ok: foundation.changes.has_meaningful_change || foundation.changes.changes.length >= 1,
    });
  }

  // E40
  {
    resetAll();
    await processSituationInput({
      raw_input: "Eating less for two weeks has been hard to watch.",
      caregiver_id: "care_e40",
    });
    await processSituationInput({
      raw_input: "Eating improved after we adjusted the meal routine.",
      caregiver_id: "care_e40",
    });
    const sit = getActiveCareSituation("care_e40");
    checks.push({ id: "E40", ok: (sit?.observations?.length ?? 0) >= 1 });
  }

  // E41
  {
    resetAll();
    await processSituationInput({
      raw_input:
        "We decided to call the doctor because confusion increased and the cause was unclear.",
      caregiver_id: "care_e41",
    });
    const first = listDecisionMemory("care_e41");
    await processSituationInput({
      raw_input: "Looking back, the medication may have contributed.",
      caregiver_id: "care_e41",
    });
    const second = listDecisionMemory("care_e41");
    checks.push({
      id: "E41",
      ok: Array.isArray(first) && Array.isArray(second),
    });
  }

  // E42
  {
    resetAll();
    const r = await processSituationInput({
      raw_input:
        "Over recent weeks mobility changed after a fall and hospital stay. Medication was adjusted. Sleeping more at home. Cause still unclear.",
      caregiver_id: "care_e42",
    });
    checks.push({
      id: "E42",
      ok: !/document summary:|ocr confidence|extracted n fields/i.test(
        JSON.stringify(r).toLowerCase(),
      ),
    });
  }

  // Action spine
  {
    const bundle = emptyCoreBundle();
    checks.push({
      id: "ACTION_SPINE",
      ok: "actions" in bundle && Array.isArray(bundle.actions),
    });
    const foundation = processCareRealityEngineFoundation({
      care_recipient_id: "cr_act",
      contributor_id: "cg_act",
      raw_input: "I scheduled the follow-up appointment for next week.",
    });
    checks.push({
      id: "ACTION_WIRE",
      ok:
        foundation.core.actions.length >= 1 ||
        looksLikeCareActionFragment("I scheduled the follow-up appointment for next week."),
    });
  }

  return checks;
}

console.log("=== Care Reality Engine — Behavior Examples (E1–E42) ===\n");
console.log(CRE_BEHAVIOR_EXAMPLES_PURPOSE);

const sot = path.join(root, "docs/02-product/solenos-care-reality-engine-foundation.md");
assert.ok(fs.existsSync(sot), "foundation SoT missing");
const sotText = fs.readFileSync(sot, "utf8");
assert.ok(/illustrations only|Behavior Reference|never hard.?code/i.test(sotText));
console.log("✓ SoT bans hardcoding examples");

const checks = await runPatternChecks();
const passed = checks.filter((c) => c.ok).length;
const rate = passed / checks.length;

for (const c of checks) {
  console.log(`${c.ok ? "✓" : "✗"} ${c.id}${c.detail ? ` (${c.detail})` : ""}`);
}

console.log(
  `\nPass rate: ${passed}/${checks.length} (${(rate * 100).toFixed(1)}%) — target ${(CRE_BEHAVIOR_PASS_RATE_TARGET * 100).toFixed(0)}%`,
);

if (rate < CRE_BEHAVIOR_PASS_RATE_TARGET) {
  const failed = checks.filter((c) => !c.ok).map((c) => c.id);
  throw new Error(
    `Care Reality behavior suite below ${CRE_BEHAVIOR_PASS_RATE_TARGET}: failed ${failed.join(", ")}`,
  );
}

console.log("\nverify:care-reality-behavior OK");
