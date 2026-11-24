import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

const retiredSystemIdentity = read("docs/CANONICAL_SYSTEM_IDENTITY_CONTRACT.md");
assert.match(retiredSystemIdentity, /HISTORICAL \/ NOT AUTHORITATIVE/);
assert.match(retiredSystemIdentity, /must not define SolenOS product identity/);

const retiredAiConstitution = read("docs/SOLENOS_AI_CONSTITUTION.md");
assert.match(retiredAiConstitution, /HISTORICAL \/ NOT AUTHORITATIVE/);
assert.match(retiredAiConstitution, /active model-independent Companion identity and behavior authority/);
assert.doesNotMatch(retiredAiConstitution, /supersedes any individual prompt/i);

const aiSystems = read("docs/10-ai-systems/README.md");
assert.match(aiSystems, /canonical, model-independent Companion identity/i);
assert.match(aiSystems, /solenos-companion-identity-constitution\.md/);
assert.match(aiSystems, /Frontend screens must not define a competing Companion identity/);

const activeArchitecture = read("src/lib/canonical-architecture/contract.ts");
assert.match(activeArchitecture, /Living Care Record/i);
assert.match(activeArchitecture, /care journey over time/i);

const retiredImportPatterns = [
  /from\s+["'][^"']*solenos-constitution(?:\/index)?["']/,
  /from\s+["'][^"']*intelligence\/prompt-builder["']/,
  /from\s+["'][^"']*care-situation-understanding\/llm-prompt["']/,
];

function walk(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(absolute);
    return /\.(?:ts|tsx|js|jsx|mts|mjs)$/.test(entry.name) ? [absolute] : [];
  });
}

const productionRoots = ["src/app", "src/components", "src/api", "src/intelligence", "src/lib"];
const offenders: string[] = [];
for (const directory of productionRoots) {
  if (!fs.existsSync(path.join(root, directory))) continue;
  for (const file of walk(path.join(root, directory))) {
    const source = fs.readFileSync(file, "utf8");
    for (const pattern of retiredImportPatterns) {
      if (pattern.test(source)) {
        offenders.push(path.relative(root, file).replace(/\\\\/g, "/"));
        break;
      }
    }
  }
}
assert.deepEqual([...new Set(offenders)], [],
  "Retired frontend constitution and prompt-builder modules must not enter active application code");

console.log("✓ legacy identity documents are explicitly non-authoritative");
console.log("✓ active identity points to the backend-owned Companion constitution");
console.log("✓ retired frontend constitution/prompt modules are isolated from application code");
