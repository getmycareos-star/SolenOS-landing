/**
 * verify-cognitive-relief.mts
 * Cognitive Relief Modules — living care record + six relief capabilities.
 */

import fs from "node:fs";
import path from "node:path";

import {
  resetCareRecipientProfileStore,
  resetSharedViewStore,
  ingestCareEntry,
  generateSummary,
  generateCheckin,
  generateSharedView,
  computePoolRunway,
  upsertLocation,
  ensureDefaultLocations,
  CHECKIN_CLOSING_TEMPLATE,
} from "../src/lib/cognitive-relief";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== SolenOS Cognitive Relief Modules ===\n");

resetCareRecipientProfileStore();
resetSharedViewStore();

const entry1 = await ingestCareEntry({
  content: "Grandma seems more confused today. She forgot our conversation.",
  raw_entry_id: "ce_1",
  caregiver_id: "cg_relief",
});

assert(entry1.tags_added.some((t) => t.tag === "confusion"), "auto-tags confusion");
assert(entry1.profile.profile.tagged_event_log.length >= 1, "tagged_event_log grows");
console.log("✓ ingest + auto-tagging");

const entry2 = await ingestCareEntry({
  content: "Mom was confused again this morning — worse than yesterday.",
  raw_entry_id: "ce_2",
  caregiver_id: "cg_relief",
});

assert(entry2.pattern_context?.seen_before === true, "pattern surfaces unprompted");
assert(entry2.pattern_context!.note.includes("confusion"), "pattern note references tag");
console.log("✓ pattern recognition surfaces automatically");

const doctorSummary = generateSummary(entry2.profile.profile, "new_doctor");
const familySummary = generateSummary(entry2.profile.profile, "family_member");

assert(doctorSummary.content.includes("medications") || doctorSummary.content.includes("conditions"), "doctor slice includes clinical context");
assert(familySummary.content.includes("help") || familySummary.content.includes("open"), "family slice differs from doctor");
assert(doctorSummary.content !== familySummary.content, "audience determines content not just format");
console.log("✓ tell-once audience-specific summaries");

let profile = ensureDefaultLocations(entry2.profile.profile);
profile = {
  ...profile,
  location_index: upsertLocation(profile.location_index, {
    label: "POA paperwork",
    physical_or_digital_location: "Top drawer of filing cabinet in hallway",
  }),
};

const poa = profile.location_index.find((l) => /poa/i.test(l.label));
assert(poa?.physical_or_digital_location.includes("filing cabinet"), "location index pointer");
console.log("✓ location index — pointer not vault");

const checkin = generateCheckin(profile, "weekly", null);
assert(checkin.closing_statement.includes("safe to put it down") || checkin.closing_statement.includes(CHECKIN_CLOSING_TEMPLATE.slice(0, 20)), "check-in grants permission explicitly");
assert(!checkin.closing_statement.toLowerCase().includes("todo"), "check-in not disguised todo list");
console.log("✓ close-the-loop explicit permission");

const shared = generateSharedView(
  entry2.profile.id,
  profile,
  "Sarah (sister)",
  { window: "this_week" },
  ["open_items", "how_to_help"],
);

assert(shared.token.length > 10, "share token created");
assert(shared.payload.financial_note?.toString().includes("excluded"), "financial excluded by default");
console.log("✓ asymmetric narrow sharing");

const runway = computePoolRunway(profile, 2400, ["property tax due", "roof repair"]);
assert(runway.disclaimer.toLowerCase().includes("not accounting") || runway.disclaimer.includes("Soft estimate"), "runway disclaimer");
assert(runway.runways.some((r) => r.assumptions_used.length > 0), "runway shows assumptions");
console.log("✓ runway soft signal with assumptions");

const required = [
  "src/lib/cognitive-relief/index.ts",
  "src/lib/cognitive-relief/ingest-entry.ts",
  "src/lib/cognitive-relief/modules/tell-once.ts",
  "src/lib/cognitive-relief/modules/pattern-recognition.ts",
  "src/lib/cognitive-relief/modules/location-index.ts",
  "src/lib/cognitive-relief/modules/close-loop.ts",
  "src/lib/cognitive-relief/modules/sharing.ts",
  "src/lib/cognitive-relief/modules/runway.ts",
  "db/migrations/015_cognitive_relief_foundation.sql",
  "src/app/api/cognitive-relief/profile/route.ts",
  "src/app/api/cognitive-relief/summary/route.ts",
  "src/app/api/cognitive-relief/checkin/route.ts",
  "src/app/api/cognitive-relief/share/route.ts",
  "src/app/api/cognitive-relief/runway/route.ts",
];

for (const rel of required) {
  assert(fs.existsSync(path.join(root, rel)), `missing ${rel}`);
}

const careEvents = fs.readFileSync(path.join(root, "src/app/api/care-events/route.ts"), "utf-8");
assert(careEvents.includes("ingestCareEntry"), "care-events feeds living record");
assert(careEvents.includes("pattern_context"), "care-events returns pattern context");

console.log("✓ module + API + migration files");

console.log("\n=== Cognitive Relief Modules: all checks passed ===\n");
