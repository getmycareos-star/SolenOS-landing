import assert from "node:assert/strict";
import fs from "node:fs";
import {
  selectDeferredItems,
  selectImmediatePriorities,
  selectWatchChanges,
} from "../src/components/mvp-workspace/attention-now";

const loops = [
  { id: "critical", source: "open_loop_records", priority: "high", priority_reasons: ["Critical consequence of delay was explicitly recorded"], status: "open" },
  { id: "overdue", source: "open_loop_records", priority: "high", priority_reasons: ["Persisted deadline has passed"], status: "open" },
  { id: "candidate-only", source: "events", priority: null, priority_reasons: [], status: "open" },
  { id: "high-without-reason", source: "open_loop_records", priority: "high", priority_reasons: [], status: "open" },
  { id: "completed-critical", source: "open_loop_records", priority: "high", priority_reasons: ["Persisted deadline has passed"], status: "completed" },
  { id: "deferred-critical", source: "open_loop_records", priority: "high", priority_reasons: ["Critical consequence of delay was explicitly recorded"], status: "deferred" },
  { id: "active-with-defer-reason", source: "open_loop_records", priority: "normal", priority_reasons: [], status: "open", deferred_reason: "Someone suggested waiting" },
  { id: "deferred", source: "open_loop_records", priority: "normal", priority_reasons: [], status: "deferred", deferred_reason: "Waiting for the recorded appointment" },
  { id: "rejected-defer", source: "open_loop_records", priority: "low", priority_reasons: [], status: "open" },
];

assert.deepEqual(selectImmediatePriorities(loops).map((item) => item.id), ["critical", "overdue"]);
assert.deepEqual(selectDeferredItems(loops).map((item) => item.id), ["deferred-critical", "deferred"]);

const changes = [
  { id: "candidate", attention_candidate: true, follow_up_candidate: false, is_active: true },
  { id: "disputed", attention_candidate: true, follow_up_candidate: false, confirmation_status: "rejected", is_active: true },
  { id: "superseded", attention_candidate: true, follow_up_candidate: false, is_active: false, superseded_by_change_id: "newer" },
  { id: "ordinary", attention_candidate: false, follow_up_candidate: false, is_active: true },
];
assert.deepEqual(selectWatchChanges(changes).map((item) => item.id), ["candidate"]);

const component = fs.readFileSync("src/components/mvp-workspace/LCRCurrentUnderstanding.tsx", "utf8");
assert.match(component, /Needs attention now/);
assert.match(component, /Previously postponed/);
assert.match(component, /That does not confirm they are safe to wait now/);
assert.doesNotMatch(component, /Things that can wait/);
assert.match(component, /There isn’t enough recorded care information to assess immediate priorities yet/);
assert.doesNotMatch(component, /No immediate concerns were identified in the information currently available\./);
assert.match(component, /formatWhen\(item\.occurred_at\).*formatWhen\(item\.recorded_at\)/s);
assert.match(component, /View supporting information/);
assert.match(component, /Review state:/);
assert.match(component, /assessmentError/);
assert.match(component, /changesError.*This does not mean nothing has changed/s);
assert.match(component, /patternsError.*This does not mean nothing is repeating/s);
assert.match(component, /assessment\.open_loops\.has_more/);
assert.match(component, /assessment\?\.care_attention/);
assert.match(component, /careAttention\.important_to_address/);
assert.match(component, /careAttention\.needs_clarification/);

console.log("Attention summary classification and evidence-display contract checks passed.");
