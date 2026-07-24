/**
 * Phase 4 Slice 4.1 — assertFutureCapabilityNotMvp + deferred surface file scans.
 */
import "./_verify-env.mts";
import fs from "node:fs";
import path from "node:path";

import {
  DEFERRED_SURFACE_PATH_PREFIXES,
  PHASE_SCOPE_DEFER_LIST,
  PHASE_SCOPE_LOCK_STATUS,
  assertAllFutureCapabilityProbesBlocked,
  assertDeferredSurfaceFile,
  assertFutureCapabilityNotMvp,
  assertPhaseScopeLockNotMvp,
  isDeferredSurfacePath,
  scanDeferredSurfaceContent,
} from "../src/lib/phase-scope-lock";
import { PHASE_SCOPE_LOCK } from "../src/lib/solenos-layers/architecture-map";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      out.push(...walkTsFiles(full));
    } else if (/\.(tsx?|jsx?)$/.test(ent.name)) {
      out.push(full);
    }
  }
  return out;
}

function collectDeferredSurfaceFiles(): string[] {
  const files: string[] = [];
  for (const prefix of DEFERRED_SURFACE_PATH_PREFIXES) {
    const full = path.join(root, prefix);
    if (!fs.existsSync(full)) continue;
    if (fs.statSync(full).isDirectory()) {
      files.push(...walkTsFiles(full));
    } else {
      files.push(full);
    }
  }
  return files;
}

function main(): void {
  console.log("=== Phase 4 scope lock (Slice 4.1 deferred surfaces) ===\n");

  assert(PHASE_SCOPE_LOCK_STATUS === "ACTIVE", "Scope lock must be ACTIVE");
  assert(PHASE_SCOPE_DEFER_LIST.length === 6, "Six deferred surfaces");
  assert(
    fs.existsSync(path.join(root, "docs/17-canonical-architecture/scope-lock.md")),
    "scope-lock.md must exist",
  );
  assert(
    PHASE_SCOPE_LOCK.canonicalDoc === "docs/17-canonical-architecture/scope-lock.md",
    "architecture-map PHASE_SCOPE_LOCK pointer",
  );
  assert(PHASE_SCOPE_LOCK.gates.includes("assertFutureCapabilityNotMvp"), "architecture-map lists future gate");

  // ——— assertFutureCapabilityNotMvp probes (Slice 4.1) ———
  for (const { probe, blocked } of assertAllFutureCapabilityProbesBlocked()) {
    assert(blocked, `assertFutureCapabilityNotMvp must block: ${probe}`);
  }
  console.log("✓ assertFutureCapabilityNotMvp blocks all future-capability probes");

  const blockedClarity = assertFutureCapabilityNotMvp("Ship I Need Clarity panel in MVP workspace");
  assert(blockedClarity.blocked && blockedClarity.matched === "i_need_clarity", "I Need Clarity blocked");

  const blockedVoice = assertFutureCapabilityNotMvp("Add microphone voice conversation to AddSituationPanel");
  assert(blockedVoice.blocked, "Voice UI blocked");

  // ——— assertPhaseScopeLockNotMvp (non-future defer items) ———
  const blockedGraph = assertPhaseScopeLockNotMvp("Ship Situation Graph UI for caregivers");
  assert(blockedGraph.blocked && blockedGraph.deferId === "situation_graph_ui", "Block graph UI");

  const blockedReorder = assertPhaseScopeLockNotMvp("Full pipeline.ts reorder — move compose after final_output only");
  assert(blockedReorder.blocked && blockedReorder.deferId === "pipeline_reorder", "Block pipeline reorder");

  const blockedMoment = assertPhaseScopeLockNotMvp("Care Moment capture screen in MVP workspace");
  assert(blockedMoment.blocked && blockedMoment.deferId === "future_capability_ui", "Future via phase lock");

  const allowed = assertPhaseScopeLockNotMvp("Improve composeCaregiverResponse CRS read path Phase 5");
  assert(!allowed.blocked, "Phase 5 composer work allowed");

  // ——— Deferred surface file scan (assertFutureCapabilityNotMvp on touch paths) ———
  const deferredFiles = collectDeferredSurfaceFiles();
  assert(deferredFiles.length >= 5, "Must scan mvp-workspace deferred surfaces");
  let scanned = 0;
  for (const abs of deferredFiles) {
    const rel = path.relative(root, abs).replace(/\\/g, "/");
    assert(isDeferredSurfacePath(rel), `Expected deferred path: ${rel}`);
    const content = fs.readFileSync(abs, "utf8");
    assertDeferredSurfaceFile(rel, content);
    scanned += 1;
  }
  console.log(`✓ ${scanned} deferred surface files pass assertFutureCapabilityNotMvp scan`);

  // Synthetic violation must throw
  let threw = false;
  try {
    assertDeferredSurfaceFile(
      "src/components/mvp-workspace/FakePanel.tsx",
      'export function Fake() { return <div>Care Moment</div>; }',
    );
  } catch {
    threw = true;
  }
  assert(threw, "Care Moment in deferred path must throw via assertDeferredSurfaceFile");

  const probeViolations = scanDeferredSurfaceContent(
    "src/components/mvp-workspace/Test.tsx",
    "const x = 'Care Moment';",
  );
  assert(probeViolations.length >= 1, "scanDeferredSurfaceContent detects Care Moment");
  assert(
    probeViolations[0]!.gate === "assertFutureCapabilityNotMvp",
    "Care Moment uses assertFutureCapabilityNotMvp gate",
  );

  const workspace = fs.readFileSync(
    path.join(root, "src/components/mvp-workspace/CognitiveWorkspace.tsx"),
    "utf8",
  );
  assert(/fetch\("\/api\/situation"/.test(workspace), "Workspace must use /api/situation");
  assert(!/fetch\("\/api\/analyze"/.test(workspace), "Workspace must not POST /api/analyze");

  const pipeline = fs.readFileSync(path.join(root, "src/lib/situation-entry/pipeline.ts"), "utf8");
  const compileMatch = pipeline.match(/enforceCompiledDominantOutput\s*\(/);
  const ingestMatch = pipeline.match(/ingestActiveCareObservation\s*\(\{/);
  assert(compileMatch?.index != null && ingestMatch?.index != null, "pipeline compile + ingest");
  assert(
    compileMatch.index! < ingestMatch.index!,
    "Internal compile must precede ACS ingest — no Phase 4 reorder without ADR",
  );

  console.log("✓ caregiver workspace uses /api/situation");
  console.log("✓ pipeline order preserved (compile before ACS ingest)");
  console.log("\nverify:scope-lock OK");
}

main();
