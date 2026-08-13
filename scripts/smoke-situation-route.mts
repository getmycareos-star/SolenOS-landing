import { processSituationInput } from "@/lib/situation-entry";

async function main() {
  const result = await processSituationInput({
    raw_input: "Mom had a fall yesterday in the kitchen. She seems okay now but was a bit shaken.",
    caregiver_id: "test_caregiver_smoke",
    care_session_id: "test_session_smoke",
  });

  console.log("SUCCESS");
  console.log("events_created:", result.events_created.length);
  console.log("is_first_situation:", result.is_first_situation);
  console.log("what_i_understood:", JSON.stringify(result.what_i_understood, null, 2));
  console.log("final_output:", JSON.stringify(result.final_output, null, 2));
  console.log("active_care_situation:", result.active_care_situation?.observations.length);
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
