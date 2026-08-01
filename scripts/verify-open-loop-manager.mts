/**
 * verify-open-loop-manager.mts
 * Open Loop Manager — track, resolve, reconnect, archive loops.
 */

import "./_verify-env.mts";
import assert from "node:assert/strict";
import {
  trackOpenLoop,
  resolveOpenLoop,
  reconnectOpenLoop,
  archiveOpenLoop,
  detectReconnection,
  buildOpenLoopManagerResult,
  getUnresolvedLoopsFor,
  getLoopsByCategory,
  resetOpenLoopStore,
} from "../src/lib/open-loop-manager";

console.log("=== SolenOS Open Loop Manager ===\n");

const CAREGIVER_ID = "test_cg_olm";
const CARE_RECIPIENT_ID = "test_cr_olm";

function assertLoop(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

// Reset state before tests
resetOpenLoopStore();

{
  // 1. Track an open loop
  console.log("\n--- Track Open Loop ---");
  const loop = trackOpenLoop({
    category: "unanswered_question",
    description: "Has Mom's medication been adjusted?",
    caregiver_id: CAREGIVER_ID,
    care_recipient_id: CARE_RECIPIENT_ID,
    source_event_id: "evt_001",
    priority: 2,
    tags: ["medication", "follow-up"],
  });

  assertLoop(loop.id.startsWith("loop_"), "loop id generated");
  assertLoop(loop.category === "unanswered_question", "category set");
  assertLoop(loop.status === "open", "status is open");
  assertLoop(loop.priority === 2, "priority set");
  assertLoop(loop.source_event_id === "evt_001", "source event set");
  assertLoop(loop.tags.includes("medication"), "tags set");
  console.log("✓ tracked open loop:", loop.description);

  // 2. Track a second loop
  const loop2 = trackOpenLoop({
    category: "monitoring_item",
    description: "Watch for changes in appetite",
    caregiver_id: CAREGIVER_ID,
    care_recipient_id: CARE_RECIPIENT_ID,
    source_event_id: "evt_002",
    priority: 1,
  });
  assertLoop(loop2.status === "open", "second loop open");
  console.log("✓ tracked monitoring loop:", loop2.description);
}

{
  // 3. Resolve an open loop
  console.log("\n--- Resolve Open Loop ---");
  const loops = getUnresolvedLoopsFor(CAREGIVER_ID, CARE_RECIPIENT_ID);
  assertLoop(loops.length === 2, "2 unresolved loops");

  const resolved = resolveOpenLoop({
    loop_id: loops[0]!.id,
    resolved_by_event_id: "evt_003",
    resolution: "Medication dose was confirmed by pharmacist",
  });

  assertLoop(resolved !== null, "loop resolved");
  assertLoop(resolved!.status === "resolved", "status changed to resolved");
  assertLoop(resolved!.resolution!.includes("pharmacist"), "resolution stored");
  console.log("✓ resolved:", resolved!.description);

  // Verify unresolved count decreased
  const afterResolve = getUnresolvedLoopsFor(CAREGIVER_ID, CARE_RECIPIENT_ID);
  assertLoop(afterResolve.length === 1, "1 remaining unresolved after resolve");
  console.log("✓ unresolved count decreased to", afterResolve.length);
}

{
  // 4. Reconnect an open loop
  console.log("\n--- Reconnect Open Loop ---");
  const allLoops = getUnresolvedLoopsFor(CAREGIVER_ID, CARE_RECIPIENT_ID);
  // Archive the unresolved loop to demonstrate reconnection
  const toReconnect = allLoops[0]!;

  const reconnected = reconnectOpenLoop({
    loop_id: toReconnect.id,
    source_event_id: "evt_004",
    reason: "New input references the same concern",
  });

  assertLoop(reconnected !== null, "loop reconnected");
  assertLoop(reconnected!.status === "reconnected", "status changed to reconnected");
  assertLoop(reconnected!.tags.includes("reconnected"), "reconnected tag added");
  console.log("✓ reconnected:", reconnected!.description);
}

{
  // 5. Archive an open loop
  console.log("\n--- Archive Open Loop ---");
  const loops = getUnresolvedLoopsFor(CAREGIVER_ID, CARE_RECIPIENT_ID);
  const archived = archiveOpenLoop(loops[0]!.id);

  assertLoop(archived !== null, "loop archived");
  assertLoop(archived!.status === "archived", "status changed to archived");
  console.log("✓ archived:", archived!.description);

  // Should not be in unresolved anymore
  const afterArchive = getUnresolvedLoopsFor(CAREGIVER_ID, CARE_RECIPIENT_ID);
  assertLoop(afterArchive.length === 0, "0 unresolved after archive");
  console.log("✓ all loops resolved or archived");
}

{
  // 6. Detect reconnection via text matching
  console.log("\n--- Detect Reconnection ---");
  // Add a new open loop to detect
  trackOpenLoop({
    category: "revisit_topic",
    description: "Check if the new medication is causing side effects",
    caregiver_id: CAREGIVER_ID,
    care_recipient_id: CARE_RECIPIENT_ID,
    source_event_id: "evt_005",
    tags: ["medication"],
  });

  const detected = detectReconnection({
    caregiver_id: CAREGIVER_ID,
    care_recipient_id: CARE_RECIPIENT_ID,
    raw_text: "I'm worried the new medication might be causing problems",
  });

  assertLoop(detected.length >= 1, "reconnection detected");
  console.log("✓ detected reconnection:", detected.length, "loops");
}

{
  // 7. Build full result report
  console.log("\n--- Open Loop Manager Result ---");
  const result = buildOpenLoopManagerResult(CAREGIVER_ID, CARE_RECIPIENT_ID);

  assertLoop(result.active === true, "result is active");
  assertLoop(result.total_count > 0, "has loops");
  assertLoop(result.open_count >= 0, "open count valid");
  assertLoop(result.resolved_count >= 0, "resolved count valid");
  console.log("✓ result:", result.total_count, "total,", result.resolved_count, "resolved");
}

{
  // 8. Track by category
  console.log("\n--- Category Filtering ---");
  trackOpenLoop({
    category: "pending_decision",
    description: "Decide whether to increase care hours",
    caregiver_id: CAREGIVER_ID,
    care_recipient_id: CARE_RECIPIENT_ID,
  });

  const pendingLoops = getLoopsByCategory(CAREGIVER_ID, CARE_RECIPIENT_ID, "pending_decision");
  assertLoop(pendingLoops.length >= 1, "pending decision loops found");
  console.log("✓ category filter:", pendingLoops.length, "pending decisions");
}

resetOpenLoopStore();
console.log("\n=== All open loop manager checks passed ===\n");
