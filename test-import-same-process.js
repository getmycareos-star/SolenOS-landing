// Test: Create a file and then import it in the same process
const fs = require('fs');

// Step 1: Create a simple test module
const testModuleContent = "// Test module\n\nexport function testFunction() {\n  return 'test successful';\n}\n";

console.log("Step 1: Creating test module...");
fs.writeFileSync('./test-module.ts', testModuleContent, 'utf8');
console.log("Test module created");

// Step 2: Import and use it in the same process
console.log("\nStep 2: Importing and using the test module...");
(async () => {
  try {
    const { testFunction } = await import('./test-module.ts');
    console.log("Import successful");
    const result = testFunction();
    console.log("Function result:", result);
    console.log("Test completed successfully");
  } catch (error) {
    console.error("Error importing or using test module:", error);
  }
})();