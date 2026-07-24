/**
 * Phase 5 entry gate — prerequisites before compounding learning slices.
 */
import "./_verify-env.mts";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

import { PHASE_5_COMPOUNDING_LOOP } from "../src/lib/solenos-layers/architecture-map";
import { GOLDEN_SCENARIO_MAP } from "../src/lib/solenos-layers/architecture-map";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function main(): void {
  console.log("=== Phase 5 entry gate ===\n");

  const phase5Doc = path.join(root, PHASE_5_COMPOUNDING_LOOP.canonicalDoc);
  assert(fs.existsSync(phase5Doc), "phase-5-compounding-loop.md must exist");
  assert(
    PHASE_5_COMPOUNDING_LOOP.status === "IN_PROGRESS" ||
      PHASE_5_COMPOUNDING_LOOP.status === "BLOCKED",
    "Phase 5 status must be IN_PROGRESS or BLOCKED",
  );

  const goldenMap = path.join(root, GOLDEN_SCENARIO_MAP.canonicalDoc);
  assert(fs.existsSync(goldenMap), "golden-scenario-map.md must exist (Phase 3.3)");

  const spine = fs.readFileSync(
    path.join(root, "docs/17-canonical-architecture/spine-build-sequence.md"),
    "utf8",
  );
  assert(/Phase 3.*IMPLEMENTED/.test(spine), "Phase 3 marked IMPLEMENTED");
  assert(/Phase 4.*IMPLEMENTED/.test(spine), "Phase 4 marked IMPLEMENTED");
  assert(/Slice 2\.4.*IMPLEMENTED/.test(spine), "Slice 2.4 marked IMPLEMENTED");

  const ingest = fs.readFileSync(
    path.join(root, "src/lib/active-care-situation/ingest.ts"),
    "utf8",
  );
  const hasMemoryCorrectionWire =
    /ingestMemoryCorrection/.test(ingest) &&
    /recordMemoryCorrection/.test(ingest) &&
    /memory_correction_applied/.test(ingest);
  assert(
    hasMemoryCorrectionWire,
    "Slice 2.4: ingestMemoryCorrection must be wired in ACS ingest",
  );

  console.log(">>> npm run verify:memory-correction\n");
  execSync("npm run verify:memory-correction", { stdio: "inherit", cwd: root });

  console.log(">>> npm run verify:phase4-scope-lock\n");
  execSync("npm run verify:phase4-scope-lock", { stdio: "inherit", cwd: root });

  console.log("\n>>> npm run verify:golden-scenario-map\n");
  execSync("npm run verify:golden-scenario-map", { stdio: "inherit", cwd: root });

  console.log("\nverify:phase5-entry-gate OK (all prerequisites including 2.4)");
}

main();
