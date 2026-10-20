// Test script using dynamic import for ES modules
console.log("\nAttempting to import and use the module...");

(async () => {
  try {
    const { processSituationInput } = await import('./src/lib/situation-entry/pipeline');
    console.log("Import successful");
    
    // Test the function
    try {
      const result = await processSituationInput({
        raw_input: "Test input",
        caregiver_id: "test_caregiver"
      });
      console.log("Function call successful:");
      console.log("Returned object keys:", Object.keys(result));
      console.log("Has care_state_change_report:", !!result.care_state_change_report);
      if (result.care_state_change_report) {
        console.log("care_state_change_report has has_meaningful_change:", result.care_state_change_report.has_meaningful_change);
      }
    } catch (error) {
      console.error("Error calling function:", error);
    }
  } catch (error) {
    console.error("Error importing module:", error);
  }
})();