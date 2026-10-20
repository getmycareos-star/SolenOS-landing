#!/usr/bin/env -S node --import tsx
/**
 * Verify Dementia Wedge Integration — tests the complete pipeline
 * from moment detection through change report to final output enrichment.
 */

import { detectDementiaMoments } from "../src/lib/dementia-moments";
import { buildChangeReport, formatClinicianBrief } from "../src/lib/change-report";
import type { CareRealityMemoryObject } from "../src/lib/care-reality-intelligence/care-reality-memory";
import type { CareRealityState } from "../src/lib/care-reality-state/types";
import { buildCareBriefForScenario } from "../src/lib/care-brief";
import {
  processDementiaWedge,
} from "../src/lib/dementia-wedge-integration";

let passed = 0;
let failed = 0;

function assert(label: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  PASS ${label}`);
    passed++;
  } else {
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

function assertContains(label: string, text: string, substr: string) {
  assert(label, text.toLowerCase().includes(substr.toLowerCase()), `expected "${substr}"`);
}

// ─── 1. Moment Detection ────────────────────────────────────────────────

console.log("\n=== Dementia Moment Detection ===\n");

assert("new_behavior_change detected", detectDementiaMoments("Mom started getting confused at night. She's been more agitated lately.").has_moment);
assert("doctor_appointment detected", detectDementiaMoments("We have a neurologist appointment next week.").has_moment);
assert("hospital_discharge detected", detectDementiaMoments("Dad was discharged from the hospital yesterday.").has_moment);
assert("new_caregiver detected", detectDementiaMoments("A new caregiver is starting next week. I need to explain mom's routine.").has_moment);
assert("sibling_disagreement detected", detectDementiaMoments("My sister thinks I'm overreacting but she's not here every day.").has_moment);
assert("no moment for greeting", !detectDementiaMoments("Hi, how are you?").has_moment);

const changeResult = detectDementiaMoments("Mom started wandering at night. She's never done this before.");
assert("recurring detected when change verb + domain + temporal", changeResult.has_moment);
assert("should_generate_report when change detected", changeResult.should_generate_report);

// ─── 2. Change Report Builder ───────────────────────────────────────────

console.log("\n=== Change Report Builder ===\n");

const mockMemory: CareRealityMemoryObject[] = [
  {
    id: "m1", care_key: "test", type: "observation", subject: "Mom",
    description: "Mom has been sleeping more during the day.", time: null,
    source: "caregiver", related_object_ids: [],
    confidence: { observation: "high", cause: "low" },
    status: "current", priority: 1,
    reality_signature: ["type:observation", "domain:sleep", "sleep", "day"],
    recurrence_count: 2, first_seen_at: "2025-01-10T", last_seen_at: "2025-01-20T", evidence_ref: null,
  },
  {
    id: "m2", care_key: "test", type: "event", subject: "Mom",
    description: "Medication was changed last month.", time: null,
    source: "caregiver", related_object_ids: [],
    confidence: { observation: "high", cause: "low" },
    status: "current", priority: 2,
    reality_signature: ["type:event", "domain:medical", "medication"],
    recurrence_count: 1, first_seen_at: "2025-01-05T", last_seen_at: "2025-01-05T", evidence_ref: null,
  },
  {
    id: "m3", care_key: "test", type: "observation", subject: "Mom",
    description: "Mom seems more confused in the evenings.", time: null,
    source: "caregiver", related_object_ids: [],
    confidence: { observation: "high", cause: "low" },
    status: "current", priority: 1,
    reality_signature: ["type:observation", "domain:cognition", "confused"],
    recurrence_count: 3, first_seen_at: "2025-01-08T", last_seen_at: "2025-01-18T", evidence_ref: null,
  },
];

const mockCrs = {
  id: "crs_test", caregiver_id: "test", care_recipient_label: "Mom", updated_at: "2025-01-20T",
  situation_id: null, root_event_id: null, understanding_stage: "gathering" as const,
  disclosure_stage: "early" as const, current_understanding: ["Mom usually sleeps through the night"],
  supporting_evidence: [],
  situation_summary: null, pattern_label: null, what_matters_now: null,
  open_uncertainties: ["Is the wandering related to the medication change?"],
  resolved_uncertainties: [], what_changed_in_understanding: null,
  understanding_effect: "continues_gathering" as const,
  response_evolution: {
    updates_active_situation: false, answers_previous_uncertainty: false,
    strengthens_existing_hypothesis: false, introduces_new_pattern: false,
    changes_what_matters_now: false, invalidates_previous_understanding: false,
  },
  primary_screen_question: "What happened?",
  observation_count: 3, revision: 2, continuity_hooks: ["Night wandering should be monitored"],
  understanding_revisions: [],
} as CareRealityState;

const report = buildChangeReport({
  raw_input: "Mom started wandering at night. She's never done this before and I'm worried.",
  crs: mockCrs,
  memory_objects: mockMemory,
  baseline: null,
  care_recipient_label: "Mom",
  care_recipient_id: "test",
});

assert("what_changed populated", report.what_changed.length > 0);
assert("relevant_timeline has items", report.relevant_timeline.length > 0);
assert("related_history found", report.related_history.length > 0);
assert("open_uncertainties present", report.open_uncertainties.length > 0);
assertContains("report references wandering", JSON.stringify(report), "wandering");

// ─── 3. Clinician Brief ────────────────────────────────────────────────

console.log("\n=== Clinician Brief ===\n");

const brief = formatClinicianBrief(report);
assert("executive_summary generated", brief.executive_summary.length > 0);
assert("questions_for_clinician generated", brief.questions_for_clinician.length > 0);
assert("period covered", brief.period.from !== "unknown");

// ─── 4. Care Brief ──────────────────────────────────────────────────────

console.log("\n=== Care Brief (New Caregiver Scenario) ===\n");

const careBrief = buildCareBriefForScenario({
  care_recipient_label: "Mom",
  recent_changes: ["Started wandering at night", "More confused in evenings"],
  baseline_info: ["Usually sleeps through the night"],
  history_items: ["Medication changed last month"],
  open_uncertainties: ["Is wandering related to medication change?"],
  what_matters_now: ["Monitor night wandering pattern"],
  what_can_wait: ["Detailed sleep log"],
  routines_preferences: ["Prefers warm milk before bed"],
  medical_context: ["Neurologist appointment scheduled"],
  safety_info: ["Night wandering is a safety concern"],
  questions_for_clinician: ["Is this related to medication?"],
  what_to_watch: ["Whether wandering continues"],
  for_caregivers: ["Observe and note wandering patterns"],
  source_report: report,
}, "new_caregiver");

assert("executive_summary generated", careBrief.executive_summary.length > 0);
assert("baseline section populated", careBrief.baseline.items.length > 0);
assert("for_caregivers has handoff info", careBrief.for_caregivers.length > 0);

// ─── 5. Dementia Wedge Integration ──────────────────────────────────────

console.log("\n=== Dementia Wedge Integration ===\n");

const wedgeResult = processDementiaWedge({
  raw_input: "Mom started wandering at night. She's never done this before and I'm worried.",
  crs: null,
  memory_objects: mockMemory,
  baseline: null,
  care_recipient_label: "Mom",
  care_recipient_id: "test",
  what_changed: ["Started wandering at night"],
  open_uncertainties: ["Is this related to medication?"],
  force_report: true,
});

assert("moments detected", wedgeResult.moments.has_moment);
assert("change report built", wedgeResult.change_report !== null);

// ─── Summary ────────────────────────────────────────────────────────────

console.log(`\n${"=".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${"=".repeat(50)}`);

process.exit(failed > 0 ? 1 : 0);

