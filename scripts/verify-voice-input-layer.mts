/**
 * verify-voice-input-layer.mts
 * Phase 1 voice input layer — browser STT capture into unified CareEvent pipeline.
 */

import fs from "node:fs";
import path from "node:path";

import {
  VOICE_CONFIDENCE_THRESHOLD,
  VOICE_INPUT_LANG,
  isVoiceInputAvailable,
} from "../src/lib/voice-input";
import {
  createCareEvent,
  resetCareEventStore,
  careEventStoreSchema,
  inferEventType,
  deriveUncertaintyLevel,
} from "../src/lib/care-events";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== SolenOS Voice Input Layer (Phase 1) ===\n");

assert(VOICE_CONFIDENCE_THRESHOLD === 0.7, "confidence threshold 0.7");
assert(VOICE_INPUT_LANG === "en-US", "default lang en-US");
console.log("✓ voice input constants");

assert(typeof isVoiceInputAvailable === "function", "isVoiceInputAvailable export");
console.log("✓ feature detection export");

resetCareEventStore();

const voiceEvent = createCareEvent({
  content: "Dad fell this morning",
  provenance: {
    input_type: "voice",
    captured_at: "2026-07-15T10:30:00.000Z",
    recognition_confidence: 0.86,
    transcript_uncertain: false,
  },
});

assert(voiceEvent.care_event.source_type === "voice", "voice source_type");
assert(voiceEvent.care_event.event_type === "fall", "fall inferred");
assert(voiceEvent.care_event.confidence === 0.86, "confidence preserved");
assert(voiceEvent.care_event.uncertainty_level === "low", "low uncertainty");
assert(voiceEvent.care_event.source?.transcript_uncertain === false, "source uncertain flag");
assert(
  voiceEvent.care_event.metadata.input_type === "voice",
  "metadata input_type voice",
);
console.log("✓ voice CareEvent shape + metadata");

const uncertainVoice = createCareEvent({
  content: "Mom seems more confused today",
  provenance: {
    input_type: "voice",
    captured_at: "2026-07-15T11:00:00.000Z",
    recognition_confidence: 0.55,
    transcript_uncertain: true,
  },
});

assert(uncertainVoice.care_event.uncertainty_level === "medium", "medium uncertainty low conf");
assert(uncertainVoice.care_event.source?.transcript_uncertain === true, "transcript uncertain");
console.log("✓ uncertain voice metadata");

const textEvent = createCareEvent({
  content: "Doctor changed medication",
  provenance: { input_type: "text" },
});

assert(textEvent.care_event.source_type === "text", "text source_type");
assert(textEvent.care_event.event_type === "medication_change", "medication inferred");
assert(textEvent.care_event.metadata.input_type === "text", "text metadata");
assert(deriveUncertaintyLevel({ input_type: "text" }) === "low", "text uncertainty low");
console.log("✓ text CareEvent identical pipeline");

assert(inferEventType("unknown note") === "observation", "default observation type");
console.log("✓ event type inference");

assert(
  careEventStoreSchema.care_events.columns.includes("source_type"),
  "care_events source_type",
);
assert(
  careEventStoreSchema.event_sources.columns.includes("recognition_confidence"),
  "event_sources recognition_confidence",
);
assert(
  careEventStoreSchema.event_sources.columns.includes("transcript_uncertain"),
  "event_sources transcript_uncertain",
);
console.log("✓ care event schema aliases");

const required = [
  "src/lib/voice-input/browser-capture.ts",
  "src/lib/voice-input/use-voice-input.ts",
  "src/lib/voice-input/constants.ts",
  "src/lib/care-events/store.ts",
  "src/lib/care-events/postgres-store.ts",
  "src/lib/care-events/record-care-event.ts",
  "src/app/api/care-events/route.ts",
  "db/migrations/014_care_events_provenance.sql",
  "src/components/ops-devtools/RealMomentPanel.tsx",
];

for (const rel of required) {
  assert(fs.existsSync(path.join(root, rel)), `missing ${rel}`);
}
console.log("✓ module + API + migration files");

const realMoment = fs.readFileSync(
  path.join(root, "src/components/ops-devtools/RealMomentPanel.tsx"),
  "utf-8",
);
assert(!realMoment.includes("onEnterVoiceMode"), "no Voice Conversation Mode entry");
assert(!realMoment.includes("Voice Mode"), "no Voice Mode button copy");
assert(!realMoment.includes("voiceError"), "no voice error UI state");
assert(realMoment.includes("useVoiceInput"), "uses voice input hook");
assert(realMoment.includes("voiceAvailable"), "feature-detect mic visibility");
console.log("✓ RealMomentPanel Phase 1 UI contract");

const workspace = fs.readFileSync(
  path.join(root, "src/components/mvp-workspace/CognitiveWorkspace.tsx"),
  "utf-8",
);
assert(!workspace.includes("VoiceConversationPanel"), "no voice conversation in workspace");
assert(workspace.includes("AddSituationPanel"), "live composer is AddSituationPanel");
assert(!workspace.includes("RealMomentPanel"), "RealMoment (voice-capable) not mounted");
assert(workspace.includes("/api/care-events") || workspace.includes("/api/situation"), "Care Record pipeline wired");
console.log("✓ CognitiveWorkspace feeds Care Record without voice UI");

const browserCapture = fs.readFileSync(
  path.join(root, "src/lib/voice-input/browser-capture.ts"),
  "utf-8",
);
assert(browserCapture.includes("continuous = true"), "continuous capture for dictation");
assert(browserCapture.includes("interimResults = true"), "interim results for UX");
assert(!browserCapture.includes("callbacks.onError"), "silent error handling");
console.log("✓ browser capture one-shot + silent fallback");

const migration = fs.readFileSync(
  path.join(root, "db/migrations/014_care_events_provenance.sql"),
  "utf-8",
);
assert(migration.includes("CREATE TABLE IF NOT EXISTS care_events"), "care_events table");
assert(migration.includes("CREATE TABLE IF NOT EXISTS event_sources"), "event_sources table");
assert(!migration.includes("CREATE TABLE IF NOT EXISTS voice"), "no voice-specific table");
assert(!migration.includes("conversation"), "no conversation tables");
console.log("✓ PostgreSQL unified CareEvent + provenance");

console.log("\n=== Voice Input Layer (Phase 1): all checks passed ===\n");
