/**
 * verify-continuous-care-record.mts
 * Continuous Care Record First — structured events, retrieval, historical context.
 */

import fs from "node:fs";
import path from "node:path";

import {
  resetCareEventStore,
  recordCareEventWithContext,
  listCareEventsForCaregiver,
} from "../src/lib/care-events";
import {
  structureCareInput,
  searchCareRecord,
  retrieveHistoricalContext,
  recordEventOutcome,
  CARE_RECORD_IDENTITY,
} from "../src/lib/care-record";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== SolenOS Continuous Care Record ===\n");

resetCareEventStore();

const caregiverId = "cg_care_record";

const structured = structureCareInput({
  content:
    "Neurology appointment with Dr. Smith on June 22. Medication changed from X to Y. Follow up in 30 days. Watch for dizziness.",
  occurred_at: "2026-06-22T14:00:00.000Z",
});

assert(structured.event_type === "appointment" || structured.event_type === "medication_change", "structures appointment/med content");
assert(structured.people_involved.some((p) => /Smith/i.test(p)), "extracts people");
assert(structured.decisions_made.length > 0 || structured.summary.includes("Medication"), "captures decisions or summary");
assert(structured.watch_for.length > 0 || /dizz/i.test(structured.summary), "watch for dizziness");
assert(structured.outcome?.status === "pending", "default outcome pending");
console.log("✓ structured care event from messy input");

await recordCareEventWithContext({
  content:
    "Neurology appointment with Dr. Smith. Medication changed from X to Y. Follow up in 30 days. Watch for dizziness.",
  created_by: caregiverId,
  provenance: { input_type: "text" },
  metadata: {
    document_refs: [{ id: "doc_1", name: "visit_notes.pdf", extracted_preview: "Medication Y prescribed" }],
  },
});

const dizzy = await recordCareEventWithContext({
  content: "Mom has been dizzy again this morning.",
  created_by: caregiverId,
  provenance: { input_type: "text" },
});

assert(
  (dizzy.historical_context?.matches.length ?? 0) >= 1,
  "surfaces previous related events for new symptom input",
);
const match = dizzy.historical_context!.matches[0]!;
assert(
  match.event_type === "appointment" ||
    match.event_type === "medication_change" ||
    /medication|dizz/i.test(match.summary),
  "historical match relates to prior neurology/medication event",
);
assert(dizzy.historical_context!.evidence_backed === true, "context is evidence-backed not hallucinated");
console.log("✓ retrieval-first historical context");

const events = listCareEventsForCaregiver(caregiverId);
const search = searchCareRecord(events, "medication");
assert(search.matches.length >= 1, "search finds medication events");
console.log("✓ searchable care record");

const outcomeResult = recordEventOutcome({
  event_id: events[0]!.id,
  status: "resolved",
  summary: "Dizziness improved after dosage adjustment.",
});
assert(outcomeResult.ok === true, "records outcome on event");
console.log("✓ Event → Decision → Outcome linkage");

assert(CARE_RECORD_IDENTITY.includes("continuity"), "product identity is continuity-first");
console.log("✓ continuity record product identity");

const required = [
  "src/lib/care-record/index.ts",
  "src/lib/care-record/structure-input.ts",
  "src/lib/care-record/retrieve.ts",
  "db/migrations/019_continuous_care_record.sql",
  "src/app/api/care-record/timeline/route.ts",
  "src/app/api/care-record/search/route.ts",
  "src/app/api/care-record/context/route.ts",
  "src/components/ops-devtools/CareRecordTimelinePanel.tsx",
  "src/components/ops-devtools/HistoricalContextPanel.tsx",
];

for (const rel of required) {
  assert(fs.existsSync(path.join(root, rel)), `missing ${rel}`);
}

const responseValidator = fs.readFileSync(
  path.join(root, "src/lib/response-validator/index.ts"),
  "utf-8",
);
assert(responseValidator.includes("what_is_happening"), "SolenOSResponse schema unchanged");

const analyzePipeline = fs.readFileSync(
  path.join(root, "src/lib/analyze-pipeline/index.ts"),
  "utf-8",
);
assert(analyzePipeline.includes("prioritization_engine_layer"), "prioritization engine retained");

const workspace = fs.readFileSync(
  path.join(root, "src/components/mvp-workspace/CognitiveWorkspace.tsx"),
  "utf-8",
);
assert(workspace.includes("historical_context"), "workspace surfaces historical context");

console.log("\n=== Continuous Care Record verification complete ===");
