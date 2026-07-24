/**
 * verify-situation-entry.mts
 * Event-sourced continuity — Add Situation entry pipeline.
 */

import fs from "node:fs";
import path from "node:path";

import { resetCareContextRootStore, processSituationInput, getCareContextRoot, computeWhatChanged } from "../src/lib/situation-entry";
import {
  CAREGIVER_RESPONSE_BANNED_TOKENS,
  caregiverLineContainsBannedToken,
} from "../src/lib/situation-entry";
import { resetCareEventStore } from "../src/lib/care-events/store";
import { resetDareStore } from "../src/lib/data-acquisition-resilience";
import {
  CARE_CONTEXT_ROOT_ID,
  EXTRACTED_TYPES,
  SITUATION_ENTRY_IDENTITY,
  classifyExtractedType,
} from "../src/lib/situation-entry";
import { resetPolicyEngineStore, seedVerifyConsent } from "../src/lib/policy-engine";
import { resetNormalizationStore } from "../src/lib/event-normalization/event-normalizer";
import { resetMvpSurfaceStore } from "../src/lib/mvp-surface-area";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== SolenOS Situation Entry (Event-Sourced Continuity) ===\n");

resetCareContextRootStore();
resetCareEventStore();
resetDareStore();
resetPolicyEngineStore();
resetNormalizationStore();
resetMvpSurfaceStore();
seedVerifyConsent("cg_situation");

assert(CARE_CONTEXT_ROOT_ID === "CareContextRoot", "CareContextRoot id constant");
assert(EXTRACTED_TYPES.includes("financial_issue"), "non-medical extracted types");
assert(SITUATION_ENTRY_IDENTITY.includes("event-sourced"), "system identity");
console.log("✓ system contract");

assert(classifyExtractedType("Mom fell yesterday") === "incident", "incident classification");
assert(
  classifyExtractedType("Insurance rejected the claim") === "financial_issue",
  "financial classification",
);
assert(
  classifyExtractedType("Dad is confused after discharge") === "behavioral_change",
  "behavioral change classification",
);
console.log("✓ non-medical situation classification");

const caregiverId = "cg_situation";

const first = await processSituationInput({
  raw_input: "Mom fell yesterday and hasn't been eating properly",
  caregiver_id: caregiverId,
});

assert(first.is_first_situation === true, "first situation flag");
assert(first.what_i_understood.length >= 1, "what I understood populated");
assert(first.what_is_uncertain.length >= 1, "uncertainty surfaced");
assert(first.what_needs_clarification.length >= 1, "clarification questions");
assert(first.what_will_be_tracked.length >= 1, "tracking dimensions");
assert(first.context.id === "CareContextRoot", "CareContextRoot created");
assert(first.context.root_event_id !== null, "root event assigned");
assert(first.dare !== null, "DARE layer included");

function assertNoBannedCaregiverDto(response: {
  what_is_uncertain: string[];
  what_needs_clarification: string[];
}, label: string) {
  const blob = [
    ...response.what_is_uncertain,
    ...response.what_needs_clarification,
  ].join("\n");
  for (const token of CAREGIVER_RESPONSE_BANNED_TOKENS) {
    assert(
      !blob.toLowerCase().includes(token.toLowerCase()),
      `${label} must not contain banned token "${token}"`,
    );
  }
  assert(
    !response.what_is_uncertain.some((line) => /^(entity|time|severity|consequence)$/i.test(line.trim())),
    `${label} must not expose bare schema fields`,
  );
  assert(
    !response.what_needs_clarification.some((line) => caregiverLineContainsBannedToken(line)),
    `${label} clarifiers must not contain banned tokens`,
  );
}

assertNoBannedCaregiverDto(first, "first response");
console.log("✓ first situation → CareEvent + CareContextRoot (caregiver-safe uncertainty)");

const ctx = getCareContextRoot(caregiverId);
assert(ctx !== undefined, "context persisted");
assert(ctx!.events.length >= 1, "at least one event in context");

const second = await processSituationInput({
  raw_input: "Insurance rejected the claim yesterday",
  caregiver_id: caregiverId,
});

assert(second.is_first_situation === false, "not first situation");
assert(second.what_changed.length >= 1, "what changed computed");
assert(
  second.context.events.length >= 1 || (second.dare?.provisional_count ?? 0) > 0,
  "context or provisional layer grows",
);
assertNoBannedCaregiverDto(second, "second response");
console.log("✓ what changed since last input");

const doc = await processSituationInput({
  raw_input: "",
  caregiver_id: caregiverId,
  documents: [
    {
      id: "doc_1",
      name: "Discharge Summary.pdf",
      extracted_text: `
Follow-up appointment scheduled with Dr. Martinez on March 20.
Monitor for confusion and reduced appetite.
Return visit recommended in 14 days.
Patient must take prescribed medication twice daily.
      `.trim(),
    },
  ],
});

assert(doc.document_events_count >= 1, "document → care events");
assert(doc.context.events.length >= 3, "document events linked to context");
console.log("✓ document → CareEvent pipeline");

const changes = computeWhatChanged(ctx!, second.events_created);
assert(changes.some((c) => c.includes("New event")), "diff detects new events");
console.log("✓ continuity diff engine");

const required = [
  "src/lib/situation-entry/caregiver-facing-uncertainty.ts",
  "src/lib/situation-entry/index.ts",
  "src/lib/situation-entry/pipeline.ts",
  "src/lib/situation-entry/parse-situation.ts",
  "src/lib/situation-entry/context-store.ts",
  "src/lib/situation-entry/what-changed.ts",
  "db/migrations/025_situation_entry.sql",
  "src/app/api/situation/route.ts",
  "src/components/mvp-workspace/AddSituationPanel.tsx",
  "src/components/mvp-workspace/SituationResponsePanel.tsx",
  "src/components/ops-devtools/SituationTimelinePanel.tsx",
];

for (const rel of required) {
  assert(fs.existsSync(path.join(root, rel)), `missing ${rel}`);
}

const workspace = fs.readFileSync(
  path.join(root, "src/components/mvp-workspace/CognitiveWorkspace.tsx"),
  "utf-8",
);
assert(workspace.includes("AddSituationPanel"), "Add Situation panel wired");
assert(workspace.includes("/api/situation"), "situation API primary path");
assert(workspace.includes("SituationResponsePanel"), "situation response UI");

const realMoment = fs.readFileSync(
  path.join(root, "src/components/ops-devtools/RealMomentPanel.tsx"),
  "utf-8",
);
assert(realMoment.includes("Add Situation"), "Add Situation CTA");

console.log("\n=== Situation Entry verification complete ===");
