// Create a simple test module using Node.js fs
const fs = require('fs');

const testModuleContent = "// Test module\nexport function test() {\n  return 'success';\n}\n";

fs.writeFileSync('./test-module.ts', testModuleContent, 'utf8');
console.log('Test module written');

// Now try to import it
(async () => {
  try {
    const { test } = await import('./test-module.ts');
    console.log("Import successful");
    console.log("Test result:", test());
  } catch (error) {
    console.error("Error importing module:", error);
  }
})();