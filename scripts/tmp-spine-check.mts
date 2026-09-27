import assert from "node:assert/strict";
import { processSituationInput } from "../src/lib/situation-entry";
import { resetCareContextRootStore } from "../src/lib/situation-entry/context-store";

resetCareContextRootStore();

const soft1 = await processSituationInput({
  raw_input: "She's frustrated.",
  caregiver_id: "cg_spine_check",
  timestamp: "2026-07-16T10:00:00.000Z",
});
const soft2 = await processSituationInput({
  raw_input: "She's quieter this afternoon.",
  caregiver_id: "cg_spine_check",
  timestamp: "2026-07-16T22:00:00.000Z",
});

const acsId = soft1.active_care_situation?.id;
assert.ok(acsId, "first capture opens a situation");
assert.equal(soft2.active_care_situation?.id, acsId, "same-day soft update shares the situation");
assert.ok(
  soft1.events_created.every((e) => e.situation_id === acsId),
  `every event on the first capture carries situation_id (got ${JSON.stringify(soft1.events_created.map((e) => e.situation_id))})`,
);
assert.ok(
  soft2.events_created.every((e) => e.situation_id === acsId),
  `every event on the soft update carries situation_id (got ${JSON.stringify(soft2.events_created.map((e) => e.situation_id))})`,
);
assert.ok(
  soft2.events_created.every((e) => e.root_event_id === soft1.events_created[0]?.id),
  "soft update shares the spine root",
);
console.log("events first capture:", soft1.events_created.length, "soft update:", soft2.events_created.length);
console.log("OK: every capture event is linked to its situation");
