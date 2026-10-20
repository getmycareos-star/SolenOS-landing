/**
 * verify-voice-conversation.mts
 * Asserts FUTURE voice conversation architecture (ADR-017) remains modular,
 * and is NOT an MVP product surface (ADR-018 — text + documents only).
 */

import fs from "node:fs";
import path from "node:path";

import {
  VOICE_CONVERSATION_MVP,
  SPEECH_RECOGNITION_LANG,
  toSpeechRecognitionLang,
  toSpeechSynthesisLang,
  buildVoiceSpokenResponse,
  buildVoiceModeGreeting,
  VOICE_CONVERSATION_STATES,
  FUTURE_WHISPER_STT,
  FUTURE_GEMINI_STT,
  FUTURE_CLOUD_TTS,
} from "../src/lib/voice";
import {
  VOICE_CONVERSATION_MVP as MAP_VOICE_CONVERSATION,
  VOICE_OBSERVATION_MVP,
  MVP_INPUT_ARCHITECTURE,
} from "../src/lib/solenos-layers/architecture-map";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== SolenOS Voice Conversation (FUTURE contract) ===\n");

const required = [
  "src/lib/voice/index.ts",
  "src/lib/voice/interfaces/speech-input.ts",
  "src/lib/voice/interfaces/speech-output.ts",
  "src/lib/voice/interfaces/voice-controller.ts",
  "src/lib/voice/speech-to-text/browser-web-speech.ts",
  "src/lib/voice/speech-output/browser-speech-synthesis.ts",
  "src/lib/voice/voice-controller/conversation-controller.ts",
  "src/lib/voice/voice-controller/build-spoken-response.ts",
  "src/lib/voice/speech-to-text/future/whisper-stt.ts",
  "src/lib/voice/speech-to-text/future/gemini-stt.ts",
  "src/lib/voice/speech-output/future/cloud-tts.ts",
  "src/components/ops-devtools/VoiceConversationPanel.tsx",
  "docs/15-architecture-decisions/ADR-017-voice-conversation-browser-io-mvp.md",
  "docs/15-architecture-decisions/ADR-018-mvp-input-text-documents-only.md",
  "docs/02-product/prds/voice-conversation-mvp.md",
];
for (const rel of required) {
  assert(fs.existsSync(path.join(root, rel)), `missing ${rel}`);
}
console.log("✓ module + unmounted UI + docs files");

assert(VOICE_CONVERSATION_MVP.status === "FUTURE", "voice conversation status FUTURE");
assert(MAP_VOICE_CONVERSATION.status === "FUTURE", "architecture map voice FUTURE");
assert(VOICE_OBSERVATION_MVP.status === "FUTURE", "voice observation FUTURE");
assert(MVP_INPUT_ARCHITECTURE.mvpChannels.join(",") === "text,document", "MVP channels");
assert(MVP_INPUT_ARCHITECTURE.futureChannels.includes("voice"), "voice future channel");
assert(VOICE_CONVERSATION_MVP.speechInput === "browser-web-speech", "preferred STT");
assert(
  VOICE_CONVERSATION_MVP.speechOutput === "browser-speech-synthesis",
  "preferred TTS",
);
assert(VOICE_CONVERSATION_MVP.reasoning.includes("/api/analyze"), "Gemini analyze path");
assert(MAP_VOICE_CONVERSATION.moduleRoot === "src/lib/voice", "architecture map module root");
console.log("✓ FUTURE status + providers + MVP input architecture");

assert(
  VOICE_CONVERSATION_STATES.join(",") === "idle,listening,processing,responding",
  "conversation states",
);
console.log("✓ conversation states");

const langs = Object.keys(SPEECH_RECOGNITION_LANG);
assert(langs.length === 10, "exactly 10 speech locales");
assert(langs.join(",") === "en,es,zh,tl,vi,ko,fa,ar,ru,hy", "exact language codes");
assert(toSpeechRecognitionLang("es") === "es-US", "es locale");
assert(toSpeechSynthesisLang("zh") === "zh-CN", "zh synthesis locale");
console.log("✓ 10-language locale map");

const spoken = buildVoiceSpokenResponse({
  what_is_happening: "Mom is asking the same question repeatedly tonight.",
  what_matters_now: "Stay calm and redirect gently.",
  what_can_wait: "Sorting mail can wait.",
  what_to_ask_next: "Did she take her evening medication?",
  risk_level: "medium",
});
assert(spoken.includes("Mom is asking"), "spoken includes happening");
assert(spoken.includes("What matters now"), "spoken includes matters now");
assert(!spoken.includes("whisper"), "no server STT in spoken builder");
console.log("✓ buildVoiceSpokenResponse");

assert(buildVoiceModeGreeting("en").includes("listening"), "en greeting");
assert(buildVoiceModeGreeting("es").length > 10, "es greeting");
console.log("✓ buildVoiceModeGreeting");

assert(FUTURE_WHISPER_STT.status === "FUTURE", "whisper future");
assert(FUTURE_GEMINI_STT.status === "FUTURE", "gemini stt future");
assert(FUTURE_CLOUD_TTS.status === "FUTURE", "cloud tts future");
assert(VOICE_OBSERVATION_MVP.ttsEngines[0] === "browser-speech-synthesis", "obs browser TTS");
console.log("✓ server STT + cloud TTS demoted to FUTURE");

const workspace = fs.readFileSync(
  path.join(root, "src/components/mvp-workspace/CognitiveWorkspace.tsx"),
  "utf-8",
);
assert(!workspace.includes("VoiceConversationPanel"), "workspace must not mount voice conversation");
assert(workspace.includes("AddSituationPanel"), "workspace uses text+doc composer");
assert(!workspace.includes("SolenosSpeakButton"), "workspace must not mount Hear SolenOS");

const clarityPanel = fs.readFileSync(
  path.join(root, "src/components/ops-clarity/ClarityPanel.tsx"),
  "utf-8",
);
assert(!clarityPanel.includes("useBrowserReadAloud"), "Clarity no read-aloud (ADR-018)");
assert(!clarityPanel.includes("SolenosSpeakButton"), "Clarity no Hear SolenOS");
assert(!clarityPanel.includes("/api/tts/synthesize"), "Clarity no cloud TTS");

const addPanel = fs.readFileSync(
  path.join(root, "src/components/mvp-workspace/AddSituationPanel.tsx"),
  "utf-8",
);
assert(!addPanel.includes("useVoiceInput"), "AddSituation no voice input");
assert(!/\bMic\b/.test(addPanel), "AddSituation no Mic");

const voicePanel = fs.readFileSync(
  path.join(root, "src/components/ops-devtools/VoiceConversationPanel.tsx"),
  "utf-8",
);
assert(voicePanel.includes("FUTURE"), "voice panel marked FUTURE");
assert(voicePanel.includes("useVoiceConversation"), "voice panel uses conversation hook");
assert(voicePanel.includes("voice.stateLabel"), "voice panel dynamic state labels");
assert(voicePanel.includes("onTurn"), "voice panel multi-turn hook");
assert(voicePanel.includes("Start Voice Mode"), "voice panel start control");
console.log("✓ MVP UI excludes voice; FUTURE panel preserved unmounted");

const controllerSrc = fs.readFileSync(
  path.join(root, "src/lib/voice/voice-controller/conversation-controller.ts"),
  "utf-8",
);
assert(controllerSrc.includes("turns: VoiceConversationTurn[]"), "in-memory turn history");
assert(controllerSrc.includes("priorInputRaw"), "prior turn context for analyze");
assert(!/whisper|gemini-stt|transcribeAudio/i.test(controllerSrc), "controller no server STT");
console.log("✓ multi-turn in-memory controller");

const analyzeRoute = fs.readFileSync(
  path.join(root, "src/app/api/analyze/route.ts"),
  "utf-8",
);
assert(analyzeRoute.includes("getGeminiApiKey"), "analyze uses Gemini key");
assert(!analyzeRoute.includes("whisper"), "analyze route no whisper");

const adr017 = fs.readFileSync(
  path.join(root, "docs/15-architecture-decisions/ADR-017-voice-conversation-browser-io-mvp.md"),
  "utf-8",
);
assert(/Superseded for MVP/i.test(adr017), "ADR-017 superseded for MVP");
assert(adr017.includes("ADR-018"), "ADR-017 references ADR-018");

console.log("\n=== Voice Conversation FUTURE contract: all checks passed ===\n");
