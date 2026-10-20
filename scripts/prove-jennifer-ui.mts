import { processSituationInput } from "../src/lib/situation-entry";
import { buildLivingCareRecordResponse } from "../src/lib/living-care-record-ux";

const text = "hi, im jennifer... my dad is sick and herefusedto eat.";
const response = await processSituationInput({
  raw_input: text,
  caregiver_id: `cg_jennifer_ui_${Date.now()}`,
  care_session_id: "sess_ui",
  timestamp: new Date().toISOString(),
});
const view = buildLivingCareRecordResponse({ response, rawInput: text });
console.log(
  JSON.stringify(
    {
      confirmation: view.care_event_added.confirmation,
      what_understood: view.what_understood,
      asks: view.what_needs_context,
      what_matters_now: view.what_matters_now,
      show: view.show_attention_sections,
      plan_matters: view.disclosure_plan.show_what_matters_now,
    },
    null,
    2,
  ),
);
if (view.show_attention_sections) throw new Error("premature Clarity in UI");
if ((view.what_needs_context?.length ?? 0) < 1) throw new Error("expected gap asks");
if ((view.what_needs_context?.length ?? 0) > 3) throw new Error("too many asks");
if (view.what_needs_context.some((q) => /head|fluid|walking normally/i.test(q))) {
  throw new Error("keyword quiz");
}
console.log("✓ UI — Held + gap asks; Clarity waits for understanding");
