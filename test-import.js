console.log("Starting test...");

try {
  const { processSituationInput } = require('./src/lib/situation-entry/pipeline');
  console.log("Import successful");
  
  (async () => {
    console.log("Calling function...");
    const result = await processSituationInput({
      raw_input: "Test input",
      caregiver_id: "test_caregiver"
    });
    console.log("Function call successful:", result);
  })();
} catch (error) {
  console.error("Error:", error);
}