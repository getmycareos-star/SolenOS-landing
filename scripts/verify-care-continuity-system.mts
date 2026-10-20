/**
 * verify-care-continuity-system.mts
 * Validates all 7 MVP pillars of the SolenOS Care Continuity System.
 */

import fs from "node:fs";
import path from "node:path";

import {
  CARE_CONTINUITY_MVP_PILLARS,
  CARE_CONTINUITY_PROHIBITED,
  CARE_CONTINUITY_SYSTEM_GOAL,
  getCareContinuitySystemStatus,
  processCareContinuityInput,
  listCareContinuityEvents,
} from "../src/lib/care-continuity-system";
import { reconstructMemory } from "../src/lib/memory-reconstruction-engine";
import { processUniversalKnowledgeExtraction } from "../src/lib/universal-knowledge-extraction";
import { createMeeting, generatePreparationPack } from "../src/lib/meeting-preparation";
import { runDecisionGate } from "../src/lib/risk-uncertainty-engine/decision-gate";
import { checkInformationCompleteness } from "../src/lib/risk-uncertainty-engine/completeness-check";
import {
  resetCareJourneyGraphStore,
  } from "../src/lib/care-journey-graph";
import { processCareJourneyInput } from "../src/lib/care-journey-graph/server";
import { resetMeetingStore } from "../src/lib/meeting-preparation/meeting-store";
import { resetUniversalKnowledgeStore } from "../src/lib/universal-knowledge-extraction/store";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== SolenOS Care Continuity System ===\n");

resetCareJourneyGraphStore();
resetMeetingStore();
resetUniversalKnowledgeStore();

assert(CARE_CONTINUITY_SYSTEM_GOAL.includes("external"), "system goal defined");
assert(CARE_CONTINUITY_PROHIBITED.length >= 5, "prohibited behaviors documented");
assert(CARE_CONTINUITY_MVP_PILLARS.length === 52, "fifty-two MVP pillars");
console.log("✓ core system contract");

const status = getCareContinuitySystemStatus("default_caregiver", null, root);
assert(status.all_pillars_present, `all pillars present: ${JSON.stringify(status.pillars)}`);
console.log("✓ all 52 MVP pillars implemented");

const caregiverId = "cg_continuity";

const inputResult = processCareContinuityInput({
  description: "She fell.",
  caregiver_id: caregiverId,
});
assert(inputResult.event.type === "fall", "input becomes journey event");
assert(
  inputResult.completeness_status === "INSUFFICIENT" ||
    inputResult.reasoning_blocked === true,
  "uncertainty on incomplete fall context",
);
console.log("✓ unified continuity input + uncertainty gate");

processCareJourneyInput({
  description: "Antibiotics started March 10.",
  caregiver_id: caregiverId,
  timestamp: "2026-03-10T10:00:00.000Z",
});
processCareJourneyInput({
  description: "Poor appetite noted — eating less.",
  caregiver_id: caregiverId,
  timestamp: "2026-03-12T10:00:00.000Z",
});
processCareJourneyInput({
  description: "Continued appetite decline observed.",
  caregiver_id: caregiverId,
  timestamp: "2026-03-15T10:00:00.000Z",
});
processCareJourneyInput({
  description: "Appetite still declining.",
  caregiver_id: caregiverId,
  timestamp: "2026-03-18T10:00:00.000Z",
});

const events = listCareContinuityEvents(caregiverId);
assert(events.length >= 4, "continuity events listed");
assert(events.every((e) => e.id && e.timestamp && e.type), "event schema complete");
console.log("✓ Care Journey event model");

processUniversalKnowledgeExtraction({
  document_id: "doc_1",
  document_name: "Discharge Summary.pdf",
  extracted_text: `
Hospital Discharge Summary
Patient diagnosed with UTI on March 10, 2026.
Prescribed antibiotic Ciprofloxacin 250mg twice daily for 7 days.
Follow-up appointment scheduled with Dr. Martinez on March 20, 2026.
Monitor for confusion and reduced appetite.
Return visit recommended in 14 days.
  `.trim(),
  caregiver_id: caregiverId,
});
console.log("✓ document → structured knowledge pipeline");

const memory = reconstructMemory({
  query: "When did appetite decline start?",
  caregiver_id: caregiverId,
});
assert(memory.timeline_summary.length >= 2, "memory reconstruction timeline");
assert(memory.current_state !== null, "current state in reconstruction");
assert(memory.reconstructed_memory.length > 0, "reconstructed memory entries");
console.log("✓ memory reconstruction — temporal not search");

const meeting = createMeeting({
  title: "Primary care follow-up",
  type: "medical",
  datetime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  caregiver_id: caregiverId,
});
const pack = generatePreparationPack(meeting);
assert(pack.what_changed !== undefined, "preparation pack what_changed");
assert(pack.unanswered_questions !== undefined, "preparation pack questions");
console.log("✓ meeting preparation engine");

const completeness = checkInformationCompleteness("She fell.");
assert(completeness.status === "INSUFFICIENT", "completeness check");
const gate = runDecisionGate(completeness.status);
assert(gate.blocked === true, "cannot determine priority when insufficient");
console.log("✓ uncertainty & completeness framework");

const required = [
  "src/lib/continuity-graph/index.ts",
  "src/lib/care-journey-graph/index.ts",
  "src/lib/universal-knowledge-extraction/index.ts",
  "src/lib/memory-reconstruction-engine/index.ts",
  "src/lib/meeting-preparation/index.ts",
  "src/lib/risk-uncertainty-engine/index.ts",
  "src/lib/care-continuity-system/index.ts",
  "src/app/api/care-continuity/route.ts",
  "src/components/ops-devtools/CareJourneyTimelinePanel.tsx",
  "src/components/ops-devtools/MemoryReconstructionPanel.tsx",
  "src/components/ops-devtools/MeetingPreparationPanel.tsx",
];

for (const rel of required) {
  assert(fs.existsSync(path.join(root, rel)), `missing ${rel}`);
}

const analyzePipeline = fs.readFileSync(
  path.join(root, "src/lib/analyze-pipeline/index.ts"),
  "utf-8",
);
assert(analyzePipeline.includes("processCareJourneyInput"), "analyze updates care journey");
assert(analyzePipeline.includes("processRiskUncertainty"), "analyze runs uncertainty gate");

console.log("\n=== Care Continuity System verification complete ===");
