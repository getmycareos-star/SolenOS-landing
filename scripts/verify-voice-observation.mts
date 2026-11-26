/**
 * Voice is intentionally excluded from the caregiver MVP.
 * This check protects the disabled boundary; it does not validate future voice features.
 */
import fs from "node:fs";
import path from "node:path";
import { resolveServerSttProvider, transcribeAudio } from "../src/lib/voice-observation";
import { VOICE_OBSERVATION_MVP, OBSERVATION_INTELLIGENCE_MVP } from "../src/lib/solenos-layers/architecture-map";

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

if (VOICE_OBSERVATION_MVP.status !== "FUTURE") {
  throw new Error("voice observation must remain a future capability, not an MVP feature");
}
if (OBSERVATION_INTELLIGENCE_MVP.apiRoutes.includes("POST /api/observations/voice")) {
  throw new Error("voice observation route must not be active in the caregiver MVP");
}
if (OBSERVATION_INTELLIGENCE_MVP.apiRoutes.includes("POST /api/tts/synthesize")) {
  throw new Error("speech synthesis route must not be active in the caregiver MVP");
}
if (resolveServerSttProvider() !== null) {
  throw new Error("server-side speech transcription must remain disabled");
}
const transcription = await transcribeAudio({ audio: new Blob(["voice is disabled"]) });
if (transcription.ok || transcription.code !== "NO_SERVER_STT") {
  throw new Error("server transcription must fail closed without a provider call");
}

for (const route of [
  "src/app/api/observations/voice/route.ts",
  "src/app/api/tts/synthesize/route.ts",
]) {
  if (fs.existsSync(path.join(root, route))) {
    throw new Error(`voice route must remain absent: ${route}`);
  }
}

const workspace = read("src/components/mvp-workspace/CognitiveWorkspace.tsx");
const shell = read("src/components/app-shell/AppShell.tsx");
const addSituation = read("src/components/mvp-workspace/AddSituationPanel.tsx");
const dailyCapture = read("src/components/workflows/StructuredDailyCapture.tsx");
const companion = read("src/components/workflows/AICompanion.tsx");
const qwenPanel = read("src/components/qwen/QwenAssistPanel.tsx");
for (const [name, source] of [
  ["caregiver workspace", workspace],
  ["app shell", shell],
  ["care update form", addSituation],
  ["Daily Care", dailyCapture],
  ["Ask SolenOS", companion],
  ["Companion review panel", qwenPanel],
] as const) {
  if (/VoiceConversationPanel|RealMomentPanel|useVoiceInput|SpeechRecognition|webkitSpeechRecognition|microphone|Voice Mode/i.test(source)) {
    throw new Error(`${name} must not expose voice capture or speech controls`);
  }
}

console.log("PASS: voice capture, server transcription and speech synthesis remain disabled; typed care entry stays available.");
