import fs from "node:fs";
import path from "node:path";

const routePath = path.join(process.cwd(), "src/app/api/analyze/route.ts");
const routeSource = fs.readFileSync(routePath, "utf8");
const adapterDir = path.join(process.cwd(), "src/lib/solenos-langchain-adapter");
const modelSource = fs.readFileSync(path.join(adapterDir, "model.ts"), "utf8");
const indexSource = fs.readFileSync(path.join(adapterDir, "index.ts"), "utf8");

if (
  !routeSource.includes("LEGACY_ANALYSIS_ENDPOINT_RETIRED") ||
  !routeSource.includes("status: 410") ||
  routeSource.includes("runAnalyzePipeline") ||
  routeSource.includes("GEMINI_API_KEY") ||
  routeSource.includes("OPENAI_API_KEY")
) {
  throw new Error("The legacy hosted-model analysis route must remain permanently retired.");
}
console.log("✓ legacy /api/analyze route returns 410 and cannot invoke hosted-model inference");

const adapter = modelSource + "\\n" + indexSource;
for (const forbidden of [
  "ChatGoogleGenerativeAI",
  "@langchain/google-genai",
  "GEMINI_API_KEY",
  "OPENAI_API_KEY",
  "https://api.openai.com",
  "generativelanguage.googleapis.com",
]) {
  if (adapter.includes(forbidden)) {
    throw new Error("Hosted provider reference remains in the active Qwen adapter: " + forbidden);
  }
}
console.log("✓ active frontend model adapter exposes only the configured private Qwen runtime");

console.log("\\n✓ hosted-model legacy entry is closed; Qwen remains the active inference route");
