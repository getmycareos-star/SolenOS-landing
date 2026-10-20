console.log("Starting test...");

(async () => {
  try {
    const { processSituationInput } = await import('./src/lib/situation-entry/pipeline');
    console.log("Import successful");
    
    console.log("Calling function...");
    const result = await processSituationInput({
      raw_input: "Test input",
      caregiver_id: "test_caregiver"
    });
    console.log("Function call successful:", result);
  } catch (error) {
    console.error("Error:", error);
  }
})();