import { processSituationInput } from "../src/lib/situation-entry";

const first = await processSituationInput({
  raw_input: "Mom fell yesterday and went to hospital",
  caregiver_id: "cg_wiring",
  timestamp: new Date(Date.now() - 2 * 86400000).toISOString(),
});
console.log("capture 1 downstream:", JSON.stringify((first as Record<string, unknown>).downstream_continuity, null, 2));

const second = await processSituationInput({
  raw_input: "She was confused this morning and did not eat much. I am exhausted from all of this.",
  caregiver_id: "cg_wiring",
  timestamp: new Date(Date.now() - 1 * 86400000).toISOString(),
});
console.log("capture 2 downstream:", JSON.stringify((second as Record<string, unknown>).downstream_continuity, null, 2));
