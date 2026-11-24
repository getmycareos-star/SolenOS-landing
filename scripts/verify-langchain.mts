import fs from "node:fs";
import path from "node:path";
import {
  buildSolenOSPrompt,
  SOLENOS_SYSTEM_PROMPT,
  resolveSolenOSLLMProvider,
  runSolenOSLLM,
  runSolenOSMvpLLM,
  SYSTEM_PROMPT_SPEC_MARKERS,
} from "../src/lib/solenos-langchain-adapter";

const adapterDir = path.join(process.cwd(), "src/lib/solenos-langchain-adapter");
const modelSource = fs.readFileSync(path.join(adapterDir, "model.ts"), "utf-8");
const indexSource = fs.readFileSync(path.join(adapterDir, "index.ts"), "utf-8");
const sourceRoot = path.join(process.cwd(), "src");
const retiredInferencePatterns = [
  /runSolenOSLLM/,
  /runSolenOSMvpLLM/,
  /createSolenOSChatModel/,
  /createMvpChatModel/,
  /createOllamaChatModel/,
  /ChatOpenAI/,
  /@langchain\/(?:openai|core)/,
];

function collectApplicationSource(directory: string, output: string[] = []): string[] {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (fullPath === adapterDir) continue;
      collectApplicationSource(fullPath, output);
    } else if (/\.(?:ts|tsx|js|jsx|mts|mjs)$/.test(entry.name)) {
      output.push(fullPath);
    }
  }
  return output;
}

console.log("=== legacy frontend inference — fail-closed boundary ===");

const input = "Mom missed her evening medication.";
const context = { session_id: "ses_test", turn: 2 };
if (buildSolenOSPrompt(input, context) !== buildSolenOSPrompt(input, context)) {
  throw new Error("legacy prompt builder is not deterministic");
}
console.log("✓ legacy prompt builder remains deterministic for compatibility");

if (!SOLENOS_SYSTEM_PROMPT.includes("what_is_happening")) {
  throw new Error("legacy schema prompt missing SolenOS schema fields");
}
for (const marker of SYSTEM_PROMPT_SPEC_MARKERS) {
  if (!SOLENOS_SYSTEM_PROMPT.includes(marker)) {
    throw new Error("legacy schema prompt missing spec marker: " + marker);
  }
}
console.log("✓ legacy schema markers remain available to compatibility tests");

if (modelSource.includes("ChatOpenAI") || modelSource.includes("OLLAMA_BASE_URL")) {
  throw new Error("retired frontend adapter must not contain a model transport or provider configuration");
}
if (/\.invoke\s*\(/.test(indexSource) || /new (?:SystemMessage|HumanMessage)/.test(indexSource)) {
  throw new Error("retired frontend adapter must not invoke a model");
}
console.log("✓ no model client, transport, or invocation remains in the frontend adapter");

for (const file of collectApplicationSource(sourceRoot)) {
  const source = fs.readFileSync(file, "utf-8");
  for (const pattern of retiredInferencePatterns) {
    if (pattern.test(source)) {
      throw new Error(`active frontend source references retired inference ${pattern}: ${file}`);
    }
  }
}
console.log("✓ no application route or component can call the retired inference adapter");

if (resolveSolenOSLLMProvider() !== null) {
  throw new Error("frontend inference provider must remain disabled");
}
for (const invoke of [runSolenOSLLM, runSolenOSMvpLLM]) {
  let rejected = false;
  try {
    await invoke(input);
  } catch (error) {
    rejected = String(error).includes("Direct frontend model inference is retired");
  }
  if (!rejected) throw new Error("retired frontend inference entry point did not fail closed");
}
console.log("✓ legacy entry points fail closed; authenticated backend routes own inference");

console.log("\n✓ frontend has no independent Companion model path");
