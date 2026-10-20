/**
 * Phase 4 Slice 4.2 — CI meta-verify golden-scenario-map.md completeness.
 */
import "./_verify-env.mts";
import fs from "node:fs";
import path from "node:path";

import {
  GOLDEN_SCENARIO_MAP_DOC,
  REQUIRED_GOLDEN_SCENARIO_IDS,
  extractVerifyScriptRefs,
  extractMasterMapSection,
  validateGoldenMapMarkdown,
} from "../src/lib/golden-scenario-map";
import { GOLDEN_SCENARIO_MAP } from "../src/lib/solenos-layers/architecture-map";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function main(): void {
  console.log("=== Golden scenario map meta-verify (Slice 4.2) ===\n");

  const mapPath = path.join(root, GOLDEN_SCENARIO_MAP_DOC);
  assert(fs.existsSync(mapPath), `${GOLDEN_SCENARIO_MAP_DOC} must exist`);
  assert(
    GOLDEN_SCENARIO_MAP.canonicalDoc === GOLDEN_SCENARIO_MAP_DOC,
    "architecture-map GOLDEN_SCENARIO_MAP pointer",
  );
  assert(
    GOLDEN_SCENARIO_MAP.requiredCount === REQUIRED_GOLDEN_SCENARIO_IDS.length,
    "architecture-map requiredCount matches module",
  );

  const map = fs.readFileSync(mapPath, "utf8");
  const validation = validateGoldenMapMarkdown(map);
  if (!validation.ok) {
    throw new Error(validation.errors.join("\n"));
  }

  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")) as {
    scripts: Record<string, string>;
  };

  const masterSection = extractMasterMapSection(map);
  const verifyRefs = extractVerifyScriptRefs(masterSection);
  assert(verifyRefs.length >= 10, "Master map must reference multiple verify scripts");

  const missingScripts: string[] = [];
  const missingFiles: string[] = [];
  for (const script of verifyRefs) {
    if (!pkg.scripts[script]) {
      missingScripts.push(script);
      continue;
    }
    const m = pkg.scripts[script]!.match(/scripts\/verify-([a-z0-9-]+)\.mts/);
    if (m) {
      const scriptFile = path.join(root, "scripts", `verify-${m[1]}.mts`);
      if (!fs.existsSync(scriptFile)) {
        missingFiles.push(scriptFile);
      }
    }
  }
  assert(missingScripts.length === 0, `Missing package.json scripts: ${missingScripts.join(", ")}`);
  assert(missingFiles.length === 0, `Missing verify script files: ${missingFiles.join(", ")}`);

  const composerCounts = { yes: 0, partial: 0, no: 0, "verify-only": 0 };
  for (const row of validation.rows) {
    composerCounts[row.composer] += 1;
  }
  assert(composerCounts.yes + composerCounts.partial + composerCounts["verify-only"] > 0, "Composer mix present");

  console.log(`✓ ${REQUIRED_GOLDEN_SCENARIO_IDS.length} golden IDs mapped (exact set)`);
  console.log(`✓ ${validation.rows.length} master table rows parsed`);
  console.log(`✓ ${verifyRefs.length} verify script refs → package.json + scripts/*.mts`);
  console.log(
    `✓ composer mix: yes=${composerCounts.yes} partial=${composerCounts.partial} verify-only=${composerCounts["verify-only"]}`,
  );
  console.log("\nverify:golden-scenario-map OK");
}

main();
