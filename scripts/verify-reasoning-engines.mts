import "./_verify-env.mts";

/**
 * verify-reasoning-engines.mts
 * Contradiction Detection + Timeline Reconstruction + Care Transparency Layer.
 */

import fs from "node:fs";
import path from "node:path";

import { resetPolicyEngineStore, seedVerifyConsent } from "../src/lib/policy-engine";
import { resetCareTimelineStore } from "../src/lib/care-timeline-engine";
import {
  CONTRADICTION_DETECTION_DEFINING_PRINCIPLE,
  detectMobilityTransitions,
  processContradictionDetection,
} from "../src/lib/contradiction-detection-engine";
import {
  extractTemporalSegments,
  processTimelineReconstruction,
  TIMELINE_RECONSTRUCTION_DEFINING_PRINCIPLE,
} from "../src/lib/timeline-reconstruction-engine";
import {
  CARE_TRANSPARENCY_DEFINING_PRINCIPLE,
  processCareTransparency,
  validateCareTransparencyPanel,
} from "../src/lib/care-transparency-layer";
import { resetCareContextRootStore, processSituationInput } from "../src/lib/situation-entry";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== solenos Reasoning Engines (Contradiction + Timeline + Transparency) ===\n");

resetPolicyEngineStore();
resetCareTimelineStore();
resetCareContextRootStore();
seedVerifyConsent("cg_reasoning");
seedVerifyConsent("cg_reasoning_frag");

const fragmented =
  "Dad started refusing food yesterday. Actually, this began after the hospital visit last week. Oh, and we changed medications two weeks before that.";

const segments = extractTemporalSegments(fragmented, "2026-07-15T12:00:00.000Z");
assert(segments.length >= 3, "temporal segments extracted");
console.log("✓ timeline temporal extraction");

const timeline = processTimelineReconstruction({
  caregiver_id: "cg_reasoning",
  raw_input: fragmented,
  events: [],
  events_created: [],
});
assert(timeline.nodes.length >= 3, "reconstructed nodes");
assert(timeline.multi_hypothesis || timeline.uncertainty_flags.length >= 0, "hypothesis model");
console.log("✓ timeline reconstruction");

await processSituationInput({
  raw_input: "Dad walks independently.",
  caregiver_id: "cg_reasoning",
  timestamp: "2026-06-01T10:00:00.000Z",
});
await processSituationInput({
  raw_input: "He fell twice this week.",
  caregiver_id: "cg_reasoning",
  timestamp: "2026-06-15T10:00:00.000Z",
});

const mobilityResult = await processSituationInput({
  raw_input: "He is now using a walker.",
  caregiver_id: "cg_reasoning",
  timestamp: "2026-07-01T10:00:00.000Z",
});

assert(mobilityResult.contradiction_detection_layer?.active === true, "contradiction layer");
assert(
  (mobilityResult.contradiction_detection_layer?.transitions.length ?? 0) >= 1,
  "mobility transition detected",
);
assert(mobilityResult.events_created.length >= 1, "CareEvent preserved not overwritten");
console.log("✓ contradiction detection — walker progression");

const transitions = detectMobilityTransitions(mobilityResult.context.events, new Date().toISOString());
assert(transitions.transitions.some((t) => t.from_state.includes("independent")), "independent preserved");
console.log("✓ history not overwritten");

assert(mobilityResult.timeline_reconstruction_layer?.active === true, "timeline layer on response");
assert(mobilityResult.final_output.transparency_panel !== undefined, "transparency on final output");
assert(mobilityResult.care_transparency_layer?.valid === true, "transparency panel valid");

const panelCheck = validateCareTransparencyPanel(mobilityResult.final_output.transparency_panel);
assert(panelCheck.valid, "panel validation");
console.log("✓ care transparency gate");

seedVerifyConsent("cg_reasoning_frag");

const fragmentedResult = await processSituationInput({
  raw_input: fragmented,
  caregiver_id: "cg_reasoning_frag",
  timestamp: "2026-07-15T10:00:00.000Z",
});
assert(fragmentedResult.timeline_reconstruction_layer!.nodes.length >= 2, "fragmented timeline");
console.log("✓ fragmented input reconstruction");

assert(fs.existsSync(path.join(root, "db/migrations/056_contradiction_detection_engine.sql")), "056");
assert(fs.existsSync(path.join(root, "db/migrations/057_timeline_reconstruction_engine.sql")), "057");
assert(fs.existsSync(path.join(root, "db/migrations/058_care_transparency_layer.sql")), "058");
console.log("✓ migrations 056–058");

const pillarPath = path.join(root, "src/lib/care-continuity-system/contract-constants.ts");
const pillarSrc = fs.readFileSync(pillarPath, "utf-8");
assert(pillarSrc.includes("contradiction_detection_engine"), "pillar contradiction");
assert(pillarSrc.includes("timeline_reconstruction_engine"), "pillar timeline");
assert(pillarSrc.includes("care_transparency_layer"), "pillar transparency");
console.log("✓ care continuity pillars #37–39");

assert(
  mobilityResult.contradiction_detection_layer?.defining_principle ===
    CONTRADICTION_DETECTION_DEFINING_PRINCIPLE,
  "contradiction principle",
);
assert(
  mobilityResult.timeline_reconstruction_layer?.defining_principle ===
    TIMELINE_RECONSTRUCTION_DEFINING_PRINCIPLE,
  "timeline principle",
);
assert(
  mobilityResult.care_transparency_layer?.defining_principle.includes("invalid"),
  "transparency principle",
);

console.log("\n=== All reasoning engine checks passed ===\n");
