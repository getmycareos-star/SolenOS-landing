/**
 * verify-voice-observation.mts
 * Asserts Voice Observation Capture + TTS architecture:
 * exact 10 languages, Polly vs Google routing, SSML, multi-signal extraction,
 * STT→observation path with mocked Whisper.
 */

import fs from "node:fs";
import path from "node:path";

import {
  TTS_LANGUAGES,
  routeTtsEngine,
  POLLY_LANGUAGES,
  GOOGLE_TTS_LANGUAGES,
  buildCalmSsml,
  TTS_BREAK_MS,
  TTS_PROSODY_RATE,
  TTS_PROSODY_PITCH,
  POLLY_VOICE_IDS,
  GOOGLE_TTS_VOICES,
  synthesizeSpeech,
  TTS_VOICE_SURFACE_HOOKS,
} from "../src/lib/tts";
import {
  extractObservations,
  recordObservation,
  resetObservationStore,
  observationStoreSchema,
  generateWeeklySummary,
  listStructuredForCaregiver,
} from "../src/lib/observation-intelligence";
import { captureVoiceObservation, resolveServerSttProvider } from "../src/lib/voice-observation";
import { VOICE_OBSERVATION_MVP, OBSERVATION_INTELLIGENCE_MVP } from "../src/lib/solenos-layers/architecture-map";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== SolenOS Voice Observation + TTS ===\n");

// ─── Exact 10 languages ──────────────────────────────────────────────────────
assert(TTS_LANGUAGES.length === 10, "exactly 10 TTS languages");
assert(
  TTS_LANGUAGES.join(",") === "en,es,zh,tl,vi,ko,fa,ar,ru,hy",
  "exact language order/codes — never add/remove/rename",
);
console.log("✓ TTS language list exact (10)");

// ─── Polly vs Google routing ─────────────────────────────────────────────────
for (const lang of POLLY_LANGUAGES) {
  assert(routeTtsEngine(lang) === "polly", `${lang} → polly`);
}
for (const lang of GOOGLE_TTS_LANGUAGES) {
  assert(routeTtsEngine(lang) === "google", `${lang} → google`);
}
assert(POLLY_LANGUAGES.join(",") === "en,es,zh,ko,ru,ar", "polly set");
assert(GOOGLE_TTS_LANGUAGES.join(",") === "tl,vi,fa,hy", "google set");
assert(POLLY_VOICE_IDS.en.female === "Joanna", "en Joanna");
assert(POLLY_VOICE_IDS.es.female === "Penelope", "es Penelope");
assert(POLLY_VOICE_IDS.zh.female === "Zhiyu", "zh Zhiyu");
assert(POLLY_VOICE_IDS.ko.female === "Seoyeon", "ko Seoyeon");
assert(POLLY_VOICE_IDS.ru.female === "Tatyana", "ru Tatyana");
assert(POLLY_VOICE_IDS.ar.female === "Zeina", "ar Zeina");
assert(GOOGLE_TTS_VOICES.tl.female.languageCode === "fil-PH", "tl fil-PH");
assert(GOOGLE_TTS_VOICES.vi.female.name === "vi-VN-Wavenet-A", "vi Wavenet-A");
assert(GOOGLE_TTS_VOICES.fa.female.languageCode === "fa-IR", "fa fa-IR");
assert(GOOGLE_TTS_VOICES.hy.female.languageCode === "hy-AM", "hy hy-AM");
console.log("✓ Polly vs Google routing + voice IDs");

// ─── SSML ────────────────────────────────────────────────────────────────────
const ssml = buildCalmSsml("Mom asked where Dad was");
assert(ssml.includes("<speak>"), "ssml speak");
assert(ssml.includes(`<break time="${TTS_BREAK_MS}ms"/>`), "ssml 300ms break");
assert(ssml.includes(`rate="${TTS_PROSODY_RATE}"`), "ssml slow rate");
assert(ssml.includes(`pitch="${TTS_PROSODY_PITCH}"`), "ssml low pitch");
assert(ssml.includes("Mom asked where Dad was"), "ssml text");
console.log("✓ SSML calm envelope");

// Soft-fail without credentials
const missing = await synthesizeSpeech({
  text: "Weekly briefing",
  languagePreference: "en",
  voiceProfile: "female",
});
assert(missing.ok === false, "synthesize soft-fails without creds");
assert(
  missing.ok === false && missing.code === "MISSING_CREDENTIALS",
  "missing credentials code",
);
assert(missing.ok === false && missing.ssml?.includes("<speak>"), "failure still builds SSML");
console.log("✓ TTS soft-fail without credentials");

assert(TTS_VOICE_SURFACE_HOOKS.includes("voice_mode_3am"), "3am hook");
assert(TTS_VOICE_SURFACE_HOOKS.includes("weekly_care_briefing"), "briefing hook");
assert(TTS_VOICE_SURFACE_HOOKS.includes("crisis_guidance"), "crisis hook");
assert(TTS_VOICE_SURFACE_HOOKS.includes("benefit_tracker_guidance"), "benefit hook");
console.log("✓ voice surface hooks");

// ─── Multi-signal extraction ─────────────────────────────────────────────────
const multi = extractObservations(
  "She forgot what we talked about and became emotionally agitated",
);
assert(
  multi.structured.some((s) => s.category === "memory" || s.signal.includes("forget")),
  "multi: memory signal",
);
assert(
  multi.structured.some((s) => s.signal === "agitation"),
  "multi: agitation signal",
);
assert(multi.structured.length >= 2, "multi-signal from one utterance");
console.log("✓ multi-signal extraction");

// ─── STT → observation path (mocked Whisper via editedTranscript) ────────────
resetObservationStore();
const captured = await captureVoiceObservation({
  audio: new Blob([]),
  caregiverId: "cg_voice",
  editedTranscript: "Dad wandered outside at 2am",
  record: recordObservation,
});
assert(captured.ok === true, "captureVoiceObservation ok");
if (captured.ok) {
  assert(captured.transcript.includes("wandered"), "transcript set");
  assert(
    (captured.observation.structured as { signal: string }[]).some(
      (s) => s.signal === "wandering",
    ),
    "voice path extracts wandering",
  );
  assert(captured.observation.observations_this_week >= 1, "KPI increments");
}
const voiceRec = recordObservation({
  caregiver_id: "cg_voice2",
  raw_text: "Mom asked where Dad was seven times today",
  source: "voice",
});
assert(voiceRec.observations_this_week >= 1, "voice source_type path");
console.log("✓ STT→observation path (mocked server STT via edited transcript)");

// ─── STT provider routing ────────────────────────────────────────────────────
const provider = resolveServerSttProvider();
assert(
  provider === null || provider === "whisper" || provider === "gemini",
  "resolveServerSttProvider returns whisper, gemini, or null",
);
console.log(`✓ STT provider routing (${provider ?? "browser-only"})`);

// ─── Schema aliases ──────────────────────────────────────────────────────────
assert(
  observationStoreSchema.observations.columns.includes("transcript"),
  "transcript column",
);
assert(
  observationStoreSchema.observations.columns.includes("source_type"),
  "source_type column",
);
assert(
  observationStoreSchema.structured_observations.columns.includes("extracted_signal"),
  "extracted_signal column",
);
console.log("✓ observation schema aliases");

// ─── Weekly summary enrichment ───────────────────────────────────────────────
resetObservationStore();
recordObservation({
  caregiver_id: "cg_week",
  raw_text: "She forgot the conversation and became agitated",
  source: "text",
});
recordObservation({
  caregiver_id: "cg_week",
  raw_text: "Mom asked the same question again",
  source: "voice",
});
const weekly = generateWeeklySummary(listStructuredForCaregiver("cg_week"));
assert(typeof weekly.emotionalIncidents === "number", "emotionalIncidents");
assert(typeof weekly.memoryIncidents === "number", "memoryIncidents");
assert(Array.isArray(weekly.changes), "changes");
assert(Array.isArray(weekly.recurringSignals), "recurringSignals");
assert(weekly.memoryIncidents >= 1 || weekly.observationCount >= 1, "weekly counts");
console.log("✓ weekly summary enrichment");

// ─── Modules + API routes exist ──────────────────────────────────────────────
const required = [
  "src/lib/tts/languages.ts",
  "src/lib/tts/route.ts",
  "src/lib/tts/polly.ts",
  "src/lib/tts/google-tts.ts",
  "src/lib/tts/synthesize.ts",
  "src/lib/voice-observation/whisper.ts",
  "src/lib/voice-observation/gemini-stt.ts",
  "src/lib/voice-observation/transcribe.ts",
  "src/lib/voice-observation/speech-language.ts",
  "src/lib/voice-observation/voice-mode.ts",
  "src/app/api/observations/voice/route.ts",
  "src/app/api/tts/synthesize/route.ts",
  "db/migrations/013_voice_observation_tts.sql",
];
for (const rel of required) {
  assert(fs.existsSync(path.join(root, rel)), `missing ${rel}`);
}
console.log("✓ module + API + migration files");

assert(
  VOICE_OBSERVATION_MVP.successKpi === "observations_per_caregiver_per_week",
  "voice observation KPI",
);
assert(VOICE_OBSERVATION_MVP.status === "FUTURE", "voice observation FUTURE (ADR-018)");
assert(
  VOICE_OBSERVATION_MVP.ttsEngines.join(",") === "browser-speech-synthesis",
  "preferred browser TTS",
);
assert(
  VOICE_OBSERVATION_MVP.ttsFuture?.join(",") === "polly,google",
  "future polly+google",
);
assert(
  OBSERVATION_INTELLIGENCE_MVP.futureApiRoutes?.includes("POST /api/observations/voice"),
  "architecture map voice route FUTURE",
);
assert(
  OBSERVATION_INTELLIGENCE_MVP.futureApiRoutes?.includes("POST /api/tts/synthesize"),
  "architecture map tts route FUTURE",
);
assert(
  !OBSERVATION_INTELLIGENCE_MVP.apiRoutes.includes("POST /api/observations/voice"),
  "voice not in MVP observation apiRoutes",
);

const mapSrc = fs.readFileSync(
  path.join(root, "src/lib/solenos-layers/architecture-map.ts"),
  "utf-8",
);
assert(mapSrc.includes("VOICE_OBSERVATION_MVP"), "VOICE_OBSERVATION_MVP in map");
assert(VOICE_OBSERVATION_MVP.ttsForbidden.includes("elevenlabs"), "forbids elevenlabs");
assert(VOICE_OBSERVATION_MVP.ttsForbidden.includes("piper"), "forbids piper");
assert(
  !mapSrc.includes("elevenlabs") || mapSrc.includes("ttsForbidden"),
  "elevenlabs only as forbidden",
);
console.log("✓ architecture map voice + TTS");

const migration = fs.readFileSync(
  path.join(root, "db/migrations/013_voice_observation_tts.sql"),
  "utf-8",
);
assert(migration.includes("tts_voice_profile"), "migration tts_voice_profile");
assert(migration.includes("observations"), "migration observations table");
assert(migration.includes("extracted_signal"), "migration extracted_signal");

const mig010 = fs.readFileSync(
  path.join(root, "db/migrations/010_multilingual_execution.sql"),
  "utf-8",
);
assert(
  mig010.includes("language_preference") &&
    mig010.includes("'en','es','zh','tl','vi','ko','fa','ar','ru','hy'"),
  "010 already defines language_preference CHECK",
);
console.log("✓ migrations language_preference + 013 voice");

console.log("\n=== Voice Observation + TTS: all checks passed ===\n");
