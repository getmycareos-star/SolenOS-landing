/**
 * Input Entry Contract — Scan / Snap / Upload / Share; same pipeline after evidence.
 * SoT: docs/02-product/solenos-input-entry-contract.md
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  INPUT_ENTRY_CONTRACT_PURPOSE,
  INPUT_ENTRY_ACTION_CONTRACT,
  EVIDENCE_PIPELINE_AFTER_ENTRY,
  UPLOAD_FILE_ACCEPT,
  entryMethodToInputType,
  assertEntryMethodDoesNotBranchReasoning,
  MVP_COMPOSER_ENTRY_ACTIONS,
} from "../src/lib/input-entry-contract";

const root = process.cwd();

console.log("=== Input Entry Contract ===\n");
console.log(INPUT_ENTRY_CONTRACT_PURPOSE);

assert.equal(INPUT_ENTRY_ACTION_CONTRACT.scan.opens, "document_scanner");
assert.ok(INPUT_ENTRY_ACTION_CONTRACT.scan.never.includes("normal_file_picker"));
assert.equal(INPUT_ENTRY_ACTION_CONTRACT.snap.opens, "live_camera");
assert.ok(INPUT_ENTRY_ACTION_CONTRACT.snap.never.includes("document_scanner"));
assert.equal(INPUT_ENTRY_ACTION_CONTRACT.upload.opens, "system_file_picker");
assert.ok(INPUT_ENTRY_ACTION_CONTRACT.upload.never.includes("camera"));
assert.equal(INPUT_ENTRY_ACTION_CONTRACT.share.opens, "os_share_target");
console.log("✓ action opens/never contracts");

assert.deepEqual(
  [...EVIDENCE_PIPELINE_AFTER_ENTRY],
  [
    "evidence_understanding",
    "care_reality_update",
    "situation_relationship_engine",
    "response_contract",
  ],
);
console.log("✓ shared evidence pipeline");

assert.equal(entryMethodToInputType("scan"), "document");
assert.equal(entryMethodToInputType("snap"), "document");
assert.equal(entryMethodToInputType("upload"), "document");
assert.equal(entryMethodToInputType("share"), "document");
assert.equal(entryMethodToInputType("text"), "text");
assertEntryMethodDoesNotBranchReasoning(false);
console.log("✓ entry_method maps to channels without reasoning branch");

const panel = fs.readFileSync(
  path.join(root, "src", "components", "mvp-workspace", "AddSituationPanel.tsx"),
  "utf8",
);
assert(panel.includes("SnapCameraCapture"));
assert(panel.includes("ScanDocumentCapture"));
assert(panel.includes("UPLOAD_FILE_ACCEPT") || panel.includes(UPLOAD_FILE_ACCEPT.slice(0, 20)));
assert(panel.includes('setSnapOpen(true)'));
assert(panel.includes('setScanOpen(true)'));
assert(!panel.includes('capture="environment"'), "Snap must not use file-input capture shortcut as primary");
assert(panel.includes("Share2") || panel.includes("Share"));
for (const action of MVP_COMPOSER_ENTRY_ACTIONS) {
  assert(panel.toLowerCase().includes(action), `composer must expose ${action}`);
}
console.log("✓ AddSituationPanel wires Scan/Snap/Upload/Share");

const snap = fs.readFileSync(
  path.join(root, "src", "components", "mvp-workspace", "capture", "SnapCameraCapture.tsx"),
  "utf8",
);
assert(snap.includes("getUserMedia"));
assert(snap.includes("not a document scan") || snap.includes("Not document"));
console.log("✓ Snap uses live camera");

const scan = fs.readFileSync(
  path.join(root, "src", "components", "mvp-workspace", "capture", "ScanDocumentCapture.tsx"),
  "utf8",
);
assert(scan.includes("getUserMedia"));
assert(scan.includes("document") || scan.includes("Document"));
assert(!scan.includes('type="file"'));
console.log("✓ Scan uses document capture (not file picker)");

const manifest = fs.readFileSync(path.join(root, "public", "manifest.webmanifest"), "utf8");
assert(manifest.includes("share_target"));
assert(manifest.includes("/share-target"));
console.log("✓ Share Target registered in manifest");

assert(fs.existsSync(path.join(root, "src", "app", "share-target", "route.ts")));
assert(fs.existsSync(path.join(root, "src", "app", "api", "share-intake", "route.ts")));
console.log("✓ share-target receive + claim API exist");

const sot = fs.readFileSync(
  path.join(root, "docs", "02-product", "solenos-input-entry-contract.md"),
  "utf8",
);
assert(sot.includes("never change the reasoning engine") || sot.includes("never** change"));
console.log("✓ SoT present");

console.log("\nAll input-entry-contract checks passed.");
