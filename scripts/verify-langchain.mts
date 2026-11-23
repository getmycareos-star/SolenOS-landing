import fs from "node:fs";
import path from "node:path";
import {
  buildSolenOSPrompt,
  SOLENOS_SYSTEM_PROMPT,
  resolveSolenOSLLMProvider,
  runSolenOSLLM,
  SYSTEM_PROMPT_SPEC_MARKERS,
} from "../src/lib/solenos-langchain-adapter";

const adapterDir = path.join(process.cwd(), "src/lib/solenos-langchain-adapter");
const modelSource = fs.readFileSync(path.join(adapterDir, "model.ts"), "utf-8");
const indexSource = fs.readFileSync(path.join(adapterDir, "index.ts"), "utf-8");

const forbiddenProviderTokens = [
  "ChatGoogleGenerativeAI",
  "OPENAI_API_KEY",
  "OPENAI_BASE_URL",
  "GEMINI_API_KEY",
  "@langchain/google-genai",
  "gpt-4o",
  "invokeGeminiExecution",
];

console.log("=== solenos-langchain-adapter — QWEN-ONLY EXECUTION SPEC ===");

const input = "Mom missed her evening medication.";
const context = { session_id: "ses_test", turn: 2 };
const promptA = buildSolenOSPrompt(input, context);
const promptB = buildSolenOSPrompt(input, context);
if (promptA !== promptB) throw new Error("prompt builder is not deterministic");
console.log("✓ deterministic prompt assembly");

if (!SOLENOS_SYSTEM_PROMPT.includes("what_is_happening")) {
  throw new Error("system prompt missing SolenOS schema fields");
}
for (const marker of SYSTEM_PROMPT_SPEC_MARKERS) {
  if (!SOLENOS_SYSTEM_PROMPT.includes(marker)) {
    throw new Error("system prompt missing spec marker: " + marker);
  }
}
console.log("✓ SolenOS system prompt includes required schema and format rules");

const adapterSource = modelSource + "\n" + indexSource;
for (const token of forbiddenProviderTokens) {
  if (adapterSource.includes(token)) {
    throw new Error("forbidden provider reference in Qwen adapter: " + token);
  }
}
console.log("✓ adapter exposes no Gemini or OpenAI-hosted provider");
if (!/toLowerCase\(\)\.startsWith\("qwen"\)/.test(modelSource)) {
  throw new Error("the private Ollama adapter must reject non-Qwen model names");
}
console.log("✓ adapter rejects non-Qwen Ollama model names");

const provider = resolveSolenOSLLMProvider();
if (provider && provider !== "ollama") throw new Error("unexpected provider: " + provider);
if (!provider) {
  let rejected = false;
  try { await runSolenOSLLM(input); } catch { rejected = true; }
  if (!rejected) throw new Error("expected explicit failure when Qwen is not configured");
  console.log("✓ missing Qwen configuration fails; no fallback");
} else {
  console.log("✓ Qwen/Ollama provider resolved (live call skipped in this check)");
}

console.log("\n✓ LangChain adapter is prompt assembly plus single-pass Qwen invocation");
