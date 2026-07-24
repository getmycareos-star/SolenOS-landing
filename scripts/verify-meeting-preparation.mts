/**
 * verify-meeting-preparation.mts
 * Meeting Preparation Engine — context restoration before caregiving conversations.
 */

import fs from "node:fs";
import path from "node:path";

import {
  resetMeetingStore,
  createMeeting,
  createProposedMeeting,
  confirmProposedMeeting,
  generatePreparationPack,
  prepareMeetingNow,
  runMeetingPreparationTrigger,
  recordMeetingOutcome,
  detectProposedMeetingsFromText,
  isWithinPreparationWindow,
  PREPARATION_WINDOWS_HOURS,
  MEETING_PREPARATION_IDENTITY,
  toMeetingPreparationLayerPayload,
} from "../src/lib/meeting-preparation";
import {
  resetCareJourneyGraphStore,
  } from "../src/lib/care-journey-graph";
import { processCareJourneyInput } from "../src/lib/care-journey-graph/server";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function hoursFromNow(h: number): string {
  return new Date(Date.now() + h * 60 * 60 * 1000).toISOString();
}

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
}

console.log("=== SolenOS Meeting Preparation Engine ===\n");

resetMeetingStore();
resetCareJourneyGraphStore();

assert(PREPARATION_WINDOWS_HOURS.medical === 48, "medical window 48h");
assert(PREPARATION_WINDOWS_HOURS.legal === 72, "legal window 72h");
assert(MEETING_PREPARATION_IDENTITY.includes("pre-meeting context"), "product identity");
console.log("✓ contract constants and preparation windows");

const caregiverId = "cg_meeting";

processCareJourneyInput({
  description: "Started antibiotics for UTI.",
  caregiver_id: caregiverId,
  timestamp: hoursAgo(72),
});
processCareJourneyInput({
  description: "Mom seems more confused and eating less.",
  caregiver_id: caregiverId,
  timestamp: hoursAgo(24),
});
processCareJourneyInput({
  description: "Medication adjusted at last visit.",
  caregiver_id: caregiverId,
  timestamp: hoursAgo(48),
  metadata: { event_kind: "medication_change" },
});

const completed = createMeeting({
  title: "Primary care follow-up",
  type: "medical",
  datetime: hoursAgo(168),
  caregiver_id: caregiverId,
});
recordMeetingOutcome({
  meeting_id: completed.id,
  outcome: {
    decisions_made: ["Continue current medication"],
    advice_received: [],
    responsibilities_assigned: [],
    follow_up_actions: [],
    new_questions: [],
    documents_received: [],
    deadlines_created: [],
  },
});

const upcoming = createMeeting({
  title: "Neurology specialist visit",
  type: "medical",
  datetime: hoursFromNow(24),
  caregiver_id: caregiverId,
});

assert(upcoming.status === "scheduled", "manual meeting created");
assert(upcoming.preparation_generated === false, "pack not generated yet");
assert(isWithinPreparationWindow(upcoming.datetime, "medical"), "within 48h medical window");
console.log("✓ manual meeting creation");

const pack = generatePreparationPack(upcoming);
assert(pack.meeting_id === upcoming.id, "pack linked to meeting");
assert(Array.isArray(pack.what_changed), "what_changed array");
assert(Array.isArray(pack.timeline_since_last_meeting), "timeline array");
assert(Array.isArray(pack.suggested_discussion_topics), "discussion topics array");
assert(pack.events_in_scope >= 0, "events scoped from journey");
console.log("✓ preparation pack generation from care journey");

const prepared = prepareMeetingNow(upcoming.id);
assert(prepared?.preparation_generated === true, "pack stored on meeting");
assert(prepared?.preparation_pack !== null, "preparation_pack populated");

const layer = toMeetingPreparationLayerPayload(prepared!);
assert(layer?.preparation_pack.what_changed !== undefined, "layer payload");
console.log("✓ preparation pack storage and layer payload");

const trigger = runMeetingPreparationTrigger(caregiverId);
assert(trigger.checked >= 1, "trigger checks meetings");
console.log("✓ scheduler trigger engine");

const proposals = detectProposedMeetingsFromText({
  text: "Return visit recommended. Follow-up in 14 days with Dr. Smith.",
  caregiver_id: caregiverId,
});
assert(proposals.length >= 1, "detects proposed meetings from documents");
const proposed = createProposedMeeting(proposals[0]!);
assert(proposed.status === "proposed_meeting", "proposed status");
assert(proposed.requires_user_confirmation === true, "requires confirmation");
const confirmed = confirmProposedMeeting(proposed.id);
assert(confirmed?.status === "scheduled", "user confirms proposed meeting");
console.log("✓ document-inferred meetings require confirmation");

const required = [
  "src/lib/meeting-preparation/index.ts",
  "src/lib/meeting-preparation/generate-pack.ts",
  "src/lib/meeting-preparation/trigger-engine.ts",
  "src/lib/meeting-preparation/meeting-store.ts",
  "db/migrations/023_meeting_preparation.sql",
  "src/app/api/meetings/route.ts",
  "src/app/api/meetings/prepare/route.ts",
  "src/components/ops-devtools/MeetingPreparationPanel.tsx",
];

for (const rel of required) {
  assert(fs.existsSync(path.join(root, rel)), `missing ${rel}`);
}

const realMoment = fs.readFileSync(
  path.join(root, "src/components/ops-devtools/RealMomentPanel.tsx"),
  "utf-8",
);
assert(realMoment.includes("MeetingPreparationPanel"), "meeting prep in workspace");

console.log("\n=== Meeting Preparation verification complete ===");
