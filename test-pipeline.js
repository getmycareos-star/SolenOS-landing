// Test script to verify the pipeline.ts file works
console.log("Testing pipeline.ts file...");

(async () => {
  try {
    const { processSituationInput } = await import('./src/lib/situation-entry/pipeline');
    console.log("Import successful");
    
    // Test with a simple input
    const result = await processSituationInput({
      raw_input: "Dad has been calm and cooperative most days.",
      caregiver_id: "test_caregiver",
      timestamp: "2026-07-01T10:00:00.000Z"
    });
    
    console.log("Function call successful:");
    console.log("- Has care_state_change_report:", !!result.care_state_change_report);
    if (result.care_state_change_report) {
      console.log("- has_meaningful_change:", result.care_state_change_report.has_meaningful_change);
      console.log("- trajectory_summary:", result.care_state_change_report.trajectory_summary);
      console.log("- all_changes count:", result.care_state_change_report.all_changes.length);
    }
    
    console.log("\nPipeline.ts file is working correctly!");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
})();