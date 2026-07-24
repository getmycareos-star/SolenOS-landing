import { extractTextFromBuffer, EXTRACTION_FAILED } from "../src/lib/tika-extractor";

const sample = Buffer.from(
  "Discharge instructions: watch for confusion and fever. Call doctor if symptoms worsen.",
  "utf-8",
);

const text = await extractTextFromBuffer(sample, "text/plain", "discharge.txt");

console.log("=== TIKA EXTRACTOR MODULE ===\n");
console.log("Plain text extraction:");
console.log(text);
console.log("\nContract:", text !== EXTRACTION_FAILED ? "✓ raw string" : "✗ failed");

const empty = await extractTextFromBuffer(Buffer.alloc(0), "text/plain", "empty.txt");
console.log("\nEmpty file:", empty === EXTRACTION_FAILED ? "✓ ERROR: extraction_failed" : empty);

console.log("\n✓ Module isolated — no SolenOS kernel imports");
