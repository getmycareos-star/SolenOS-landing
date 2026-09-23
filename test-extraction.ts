import { createSemanticExtractor } from "./src/lib/semantic-extraction";
import type { ExtractionResult } from "./src/lib/semantic-extraction/types";

const TEST_NOTE = `Sarah says the patient was confused this morning around 9am and had dizziness. 
BP was 90/55. She gave the lorazepam but the pill box still has the dose in it. 
Mom says nobody gave her anything. John says she has always been confused like this. 
I wonder if the metoprolol is causing her tiredness. Appointment with Dr. Smith tomorrow at 2pm?`;

async function main() {
  console.log("=== Testing Semantic Extraction ===");
  console.log("Note:", TEST_NOTE.slice(0, 100) + "...");
  
  const extractor = createSemanticExtractor();
  const available = await extractor.isAvailable();
  console.log("Ollama available:", available);
  
  if (!available) {
    console.log("Ollama not available — waiting for model...");
    return;
  }
  
  const result: ExtractionResult = await extractor.extract(TEST_NOTE);
  
  console.log("\n=== Extraction Result ===");
  console.log("Success:", result.success);
  console.log("Model:", result.model);
  console.log("Provider:", result.provider);
  console.log("Duration (ms):", result.duration_ms);
  console.log("Error:", result.error ?? "none");
  
  if (result.extraction) {
    console.log("\n=== Extracted Data ===");
    console.log("Observations:", JSON.stringify(result.extraction.observations, null, 2));
    console.log("Measurements:", JSON.stringify(result.extraction.measurements, null, 2));
    console.log("Medications:", JSON.stringify(result.extraction.medications, null, 2));
    console.log("Temporal Facts:", JSON.stringify(result.extraction.temporal_facts, null, 2));
    console.log("Attributions:", JSON.stringify(result.extraction.attributions, null, 2));
    console.log("Contradictions:", JSON.stringify(result.extraction.contradictions, null, 2));
    console.log("Uncertainties:", JSON.stringify(result.extraction.uncertainties, null, 2));
    console.log("Questions:", JSON.stringify(result.extraction.questions, null, 2));
    console.log("Appointments:", JSON.stringify(result.extraction.appointments, null, 2));
    console.log("Extraction Confidence:", result.extraction.extraction_confidence);
  }
}

main().catch(console.error);
