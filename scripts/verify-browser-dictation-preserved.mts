import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative: string) =>
  fs.readFileSync(path.join(root, relative), "utf-8");
const assert = (condition: unknown, message: string): asserts condition => {
  if (!condition) throw new Error(message);
};

const browser = read("src/lib/voice/speech-to-text/browser-web-speech.ts");
const hook = read("src/lib/voice-observation/use-web-speech.ts");
const client = read("src/lib/voice/client.ts");
const server = read("src/lib/voice-observation/transcribe.ts");
const serverClient = read("src/lib/voice-observation/observation-voice-client.ts");

assert(browser.includes("BrowserWebSpeechInput"), "browser speech input adapter must remain");
assert(browser.includes("BrowserWebSpeechDictation"), "browser dictation adapter must remain");
assert(browser.includes("SpeechRecognition"), "browser SpeechRecognition support must remain");
assert(browser.includes("webkitSpeechRecognition"), "webkit SpeechRecognition support must remain");
assert(hook.includes("defaultBrowserSpeechDictation"), "browser dictation hook must use browser adapter");
assert(hook.includes("isBrowserWebSpeechSupported"), "browser capability detection must remain");
assert(client.includes("BrowserWebSpeechDictation"), "browser dictation must remain exported");
assert(server.includes("resolveServerSttProvider(): null"), "hosted server STT provider selection must remain disabled");
assert(server.includes("NO_SERVER_STT"), "server transcription must fail closed");
assert(serverClient.includes('usedServer: false'), "future server transcription helper must never call a provider");
assert(serverClient.includes('code: "NO_SERVER_STT"'), "future server transcription helper must report disabled state");

for (const token of ["GEMINI_API_KEY", "OPENAI_API_KEY", "generativelanguage.googleapis.com", "api.openai.com"]) {
  assert(!server.includes(token) && !serverClient.includes(token), `hosted transcription reference remains: ${token}`);
}

for (const route of [
  "src/app/api/observations/voice/route.ts",
  "src/app/api/tts/synthesize/route.ts",
]) {
  assert(!fs.existsSync(path.join(root, route)), `server voice route must remain disabled: ${route}`);
}

console.log("PASS: browser dictation code is preserved; hosted server transcription and voice routes remain disabled.");
