import { processSituationInput } from "./src/lib/situation-entry/pipeline";

const TEST_NOTE = `Sarah says the patient was confused this morning around 9am and had dizziness. 
BP was 90/55. She gave the lorazepam but the pill box still has the dose in it. 
Mom says nobody gave her anything. John says she has always been confused like this. 
I wonder if the metoprolol is causing her tiredness. Appointment with Dr. Smith tomorrow at 2pm?`;

async function main() {
  console.log("=== Testing Pipeline Integration ===");
  const result = await processSituationInput({
    raw_input: TEST_NOTE,
    patient_id: "test-patient-123",
  });
  
  console.log("Semantic extraction layer:", result.semantic_extraction_layer ? "present" : "absent");
  console.log("Total events:", result.events?.length ?? 0);
  console.log("DARE events:", result.dare?.validated_events?.length ?? 0);
  console.log("Status:", result.status);
  console.log("Error:", result.error ?? "none");
  
  if (result.semantic_extraction_layer) {
    console.log("\n=== Extraction Layer ===");
    console.log("Success:", result.semantic_extraction_layer.success);
    console.log("Model:", result.semantic_extraction_layer.model);
    console.log("Duration:", result.semantic_extraction_layer.duration_ms, "ms");
    if (result.semantic_extraction_layer.extraction) {
      console.log("Observations:", result.semantic_extraction_layer.extraction.observations.length);
      console.log("Measurements:", result.semantic_extraction_layer.extraction.measurements.length);
      console.log("Medications:", result.semantic_extraction_layer.extraction.medications.length);
      console.log("Attributions:", result.semantic_extraction_layer.extraction.attributions.length);
      console.log("Contradictions:", result.semantic_extraction_layer.extraction.contradictions.length);
      console.log("Questions:", result.semantic_extraction_layer.extraction.questions.length);
      console.log("Appointments:", result.semantic_extraction_layer.extraction.appointments.length);
    }
  }
}

main().catch(console.error);