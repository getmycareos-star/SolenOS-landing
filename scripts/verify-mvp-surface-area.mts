/**
 * verify-mvp-surface-area.mts
 * MVP surface area — first screen, aha moment, post-entry continuity behavior.
 */

import fs from "node:fs";
import path from "node:path";

import { resetCareEventStore } from "../src/lib/care-events/store";
import { resetDareStore } from "../src/lib/data-acquisition-resilience";
import { resetIntegrityAuditStore } from "../src/lib/care-event-integrity";
import { resetMemoryLayerStore } from "../src/lib/care-memory-layers";
import { resetFailureResilienceStore } from "../src/lib/failure-resilience";
import { resetMoatStore } from "../src/lib/network-effect-moat";
import { resetSuccessModelStore } from "../src/lib/success-model";
import { resetMvpSurfaceStore } from "../src/lib/mvp-surface-area";
import {
  AHA_MOMENT_SECTIONS,
  MVP_CORE_THESIS,
  MVP_FIRST_SCREEN_PROMPT,
  MVP_NON_GOALS,
  MVP_SURFACE_IDENTITY,
  MVP_SUCCESS_CRITERIA,
  buildAhaMomentView,
  processMvpSurfaceArea,
  resolveMvpSystemState,
} from "../src/lib/mvp-surface-area";
import { resetCareContextRootStore, processSituationInput } from "../src/lib/situation-entry";
import {
  classifyInputMessiness,
  humanizeUncertaintyForCaregiver,
  resolveCaregiverWords,
  sanitizeCaregiverErrorMessage,
} from "../src/lib/mvp-input-architecture";
import { resetPolicyEngineStore, seedVerifyConsent } from "../src/lib/policy-engine";
import { resetNormalizationStore } from "../src/lib/event-normalization/event-normalizer";
import { assertContinuityHomeSanitized } from "../src/lib/living-care-record-ux";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== SolenOS MVP Surface Area ===\n");

resetCareContextRootStore();
resetCareEventStore();
resetDareStore();
resetIntegrityAuditStore();
resetMemoryLayerStore();
resetFailureResilienceStore();
resetMoatStore();
resetSuccessModelStore();
resetMvpSurfaceStore();
resetPolicyEngineStore();
resetNormalizationStore();
seedVerifyConsent("cg_mvp_surface");

assert(MVP_SURFACE_IDENTITY.includes("continuity engine"), "surface identity");
assert(MVP_CORE_THESIS.includes("cognitive overload"), "core thesis");
assert(MVP_FIRST_SCREEN_PROMPT === "What is happening right now?", "first screen prompt");
assert(MVP_NON_GOALS.length >= 6, "non-goals documented");
assert(AHA_MOMENT_SECTIONS.length === 5, "five aha moment sections");
assert(MVP_SUCCESS_CRITERIA.length === 5, "five success criteria");
console.log("✓ system contract");

const migration = path.join(root, "db/migrations/036_mvp_surface_area.sql");
assert(fs.existsSync(migration), "migration 036 exists");
console.log("✓ migration 036");

assert(resolveMvpSystemState(false, 0) === "empty", "empty state");
assert(resolveMvpSystemState(true, 3) === "active_continuity", "active continuity");
console.log("✓ system state transition");

const first = await processSituationInput({
  raw_input: "Dad has been refusing to eat.",
  caregiver_id: "cg_mvp_surface",
  timestamp: "2026-07-01T10:00:00.000Z",
});

assert(first.mvp_surface_area_layer !== undefined, "mvp layer on response");
assert(first.mvp_surface_area_layer.system_state === "active_continuity", "active after first");
assert(first.mvp_surface_area_layer.aha_moment !== null, "aha moment present");
assert(first.mvp_surface_area_layer.aha_moment!.sections.what_i_understood.items.some((i) =>
  i.includes("You shared:"),
), "first aha echoes caregiver words");
assert(first.is_first_situation === true, "first situation flag");
console.log("✓ first value moment (aha)");

const second = await processSituationInput({
  raw_input: "He also missed his morning medication today.",
  caregiver_id: "cg_mvp_surface",
  timestamp: "2026-07-02T10:00:00.000Z",
});

assert(second.mvp_surface_area_layer.continuity_home !== null, "continuity home after entry");
assert(second.mvp_surface_area_layer.post_entry !== null, "post-entry behavior");
assert(second.mvp_surface_area_layer.priority_surface.length >= 1, "priority surface active");

const home = second.mvp_surface_area_layer.continuity_home!;
assertContinuityHomeSanitized(home, "continuity_home");
assert(
  home.recent_events.every((e) => e.label.length > 0),
  "recent events use caregiver words",
);
// Empty delta must not invent last-N as "new" when prior count equals current (same session revisit edge)
assert(Array.isArray(home.since_last_visit.new_events), "new_events is an array");
assert(
  !/careevent/i.test(second.mvp_surface_area_layer.post_entry!.integration_summary),
  "post-entry summary has no CareEvent jargon",
);
console.log("✓ post-entry continuity behavior (sanitized continuity home)");

const aha = buildAhaMomentView(first);
assert(aha.sections.what_is_uncertain !== undefined, "uncertainty section");
console.log("✓ aha moment builder");

const apiRoute = path.join(root, "src/app/api/situation/surface/route.ts");
assert(fs.existsSync(apiRoute), "surface API route");
console.log("✓ surface API route");

const addPanel = path.join(root, "src/components/mvp-workspace/AddSituationPanel.tsx");
const homePanel = path.join(root, "src/components/mvp-workspace/ContinuityHomePanel.tsx");
const ahaPanel = path.join(root, "src/components/ops-devtools/AhaMomentPanel.tsx");
assert(fs.existsSync(addPanel), "AddSituationPanel");
assert(fs.existsSync(homePanel), "ContinuityHomePanel");
assert(fs.existsSync(ahaPanel), "AhaMomentPanel");
const homePanelSrc = fs.readFileSync(homePanel, "utf8");
assert(
  homePanelSrc.includes("@/lib/mvp-input-architecture"),
  "ContinuityHomePanel imports sanitizers from mvp-input-architecture",
);
assert(
  homePanelSrc.includes("isCaregiverSafeDisplayText"),
  "ContinuityHomePanel uses isCaregiverSafeDisplayText",
);
const addSrc = fs.readFileSync(addPanel, "utf8");
assert(!/useVoiceInput/.test(addSrc), "AddSituationPanel must not use voice input (ADR-018)");
assert(!/\bMic\b/.test(addSrc), "AddSituationPanel must not render Mic (ADR-018)");
assert(/Snap/.test(addSrc) && /Scan/.test(addSrc) && /Upload|FileText/.test(addSrc), "Snap/Scan/Upload capture present");
assert(/Add to record/.test(addSrc), "Add to record CTA present");
assert(/Preserving/.test(addSrc), "Preserving loading copy present");
assert(/Reading document/.test(addSrc), "Reading document status present");
assert(!/\bSend\b/.test(addSrc), "no Send chat CTA in entry composer");
assert(!/clarity will appear/i.test(addSrc), "no clarity chat placeholder in composer");
assert(!/ · extracting/.test(addSrc), "no extracting engine status");
const activationPanel = path.join(root, "src/components/mvp-workspace/ActivationOutputPanel.tsx");
assert(fs.existsSync(activationPanel), "ActivationOutputPanel");
const activationSrc = fs.readFileSync(activationPanel, "utf8");
assert(!/clarity will appear/i.test(activationSrc), "no clarity placeholder on output panel");
assert(/care record will appear/i.test(activationSrc), "record-oriented idle placeholder");
assert(/Preserving/.test(activationSrc), "Preserving status on activation panel");
console.log("✓ MVP UI surface components (text + documents only)");

const mvpInput = path.join(root, "src/lib/mvp-input-architecture/index.ts");
assert(fs.existsSync(mvpInput), "mvp-input-architecture module");
const mvpInputSrc = fs.readFileSync(mvpInput, "utf8");
assert(mvpInputSrc.includes("ADR-018"), "mvp-input-architecture cites ADR-018");
assert(mvpInputSrc.includes('"text"') && mvpInputSrc.includes('"document"'), "text+document channels");
assert(mvpInputSrc.includes("voice_is_future_input_not_mvp"), "voice deferred principle");
assert(mvpInputSrc.includes("classifyInputMessiness"), "first-input messiness classifier");
assert(mvpInputSrc.includes("sanitizeCaregiverErrorMessage"), "caregiver error sanitizer exported");
console.log("✓ MVP input architecture module");

assert(
  !/careevent/i.test(sanitizeCaregiverErrorMessage("Consent required before CareEvent creation.")),
  "error sanitizer strips CareEvent",
);
assert(
  /care record/i.test(sanitizeCaregiverErrorMessage("Consent required before CareEvent creation.")),
  "error sanitizer uses record language",
);

assert(classifyInputMessiness("dad is refusing to eat") === "messy", "short note is messy");
assert(
  classifyInputMessiness(
    "Mom fell yesterday morning. She hit her head and we went to urgent care.",
  ) === "structured",
  "dated multi-clause is structured",
);
assert(
  humanizeUncertaintyForCaregiver("time") === "When did this start or happen?",
  "humanize time field",
);
const words = resolveCaregiverWords(
  [{ raw_input: "observation signal", attributes: { source_situation_text: "dad won't eat" } }],
);
assert(words === "dad won't eat", "resolve caregiver words over signal jargon");
console.log("✓ first-input contract (any messiness level)");

const adr018 = path.join(
  root,
  "docs/15-architecture-decisions/ADR-018-mvp-input-text-documents-only.md",
);
assert(fs.existsSync(adr018), "ADR-018 exists");
console.log("✓ ADR-018 MVP input decision");

console.log("\n=== All MVP surface area checks passed ===\n");
