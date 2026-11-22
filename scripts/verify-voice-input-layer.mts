/**
 * Typed care entry remains available; voice capture is intentionally excluded from the MVP.
 * This check protects the caregiver-facing boundary and the PostgreSQL care-event path.
 */
import fs from "node:fs";
import path from "node:path";
import {
  createCareEvent,
  resetCareEventStore,
  careEventStoreSchema,
  inferEventType,
  deriveUncertaintyLevel,
} from "../src/lib/care-events";
import { VOICE_OBSERVATION_MVP, OBSERVATION_INTELLIGENCE_MVP } from "../src/lib/solenos-layers/architecture-map";

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

console.log("=== SolenOS typed care entry; voice disabled ===\\n");

assert(VOICE_OBSERVATION_MVP.status === "FUTURE", "voice capture must remain a future capability");
assert(!OBSERVATION_INTELLIGENCE_MVP.apiRoutes.includes("POST /api/observations/voice"), "voice route must not be active");
assert(!OBSERVATION_INTELLIGENCE_MVP.apiRoutes.includes("POST /api/tts/synthesize"), "speech synthesis route must not be active");

resetCareEventStore();
const textEvent = createCareEvent({
  content: "Doctor changed medication",
  provenance: { input_type: "text" },
});
assert(textEvent.care_event.source_type === "text", "typed source_type");
assert(textEvent.care_event.event_type === "medication_change", "typed medication event is classified");
assert(textEvent.care_event.metadata.input_type === "text", "typed input metadata is preserved");
assert(textEvent.care_event.uncertainty_level === "low", "typed entry uncertainty is retained");
assert(deriveUncertaintyLevel({ input_type: "text" }) === "low", "typed entry uncertainty helper");
assert(inferEventType("unknown note") === "observation", "unknown typed note remains an observation");
console.log("✓ typed care entry and event classification");

assert(careEventStoreSchema.care_events.columns.includes("source_type"), "care_events source_type");
assert(careEventStoreSchema.event_sources.columns.includes("source_type"), "event_sources source_type");
console.log("✓ care-event source attribution schema");

const workspace = read("src/components/mvp-workspace/CognitiveWorkspace.tsx");
const shell = read("src/components/app-shell/AppShell.tsx");
const companion = read("src/components/qwen/QwenAssistPanel.tsx");
assert(workspace.includes("AddSituationPanel"), "typed care entry remains available");
assert(workspace.includes("/api/care-events") || workspace.includes("/api/situation"), "typed entry remains connected to the care record");
for (const [name, source] of [["caregiver workspace", workspace], ["app shell", shell], ["Companion", companion]] as const) {
  assert(
    !/VoiceConversationPanel|RealMomentPanel|useVoiceInput|SpeechRecognition|webkitSpeechRecognition|microphone|Voice Mode/i.test(source),
    `${name} must not expose voice capture or speech controls`,
  );
}
console.log("✓ no voice controls in caregiver-facing workspace");

for (const route of [
  "src/app/api/observations/voice/route.ts",
  "src/app/api/tts/synthesize/route.ts",
]) {
  assert(!fs.existsSync(path.join(root, route)), `voice route must remain absent: ${route}`);
}
console.log("✓ no active voice or speech-synthesis API routes");

const migration = read("db/migrations/014_care_events_provenance.sql");
assert(migration.includes("CREATE TABLE IF NOT EXISTS care_events"), "care_events table");
assert(migration.includes("CREATE TABLE IF NOT EXISTS event_sources"), "event_sources table");
assert(!migration.includes("CREATE TABLE IF NOT EXISTS voice"), "no voice-specific table");
console.log("✓ PostgreSQL care-event and source tables remain separate from voice features");

console.log("\\nPASS: typed care entry remains available; voice stays disabled.\\n");
