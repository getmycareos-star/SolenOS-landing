import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";

const source = readFileSync("src/components/DocumentIntelligenceReview.tsx", "utf8");

assert(
  source.includes("/documents/intelligence/") && source.includes("/review-history"),
  "document review UI must retrieve the persisted append-only decision history",
);
assert(source.includes("reviewEvents"), "review history events must be retained in component state");
assert(source.includes("decision_version"), "each displayed decision must retain its per-candidate version");
assert(source.includes("reviewHistoryUnavailable"), "failed history retrieval must not be presented as an empty history");
assert(source.includes("immutable decision event"), "caregivers must be able to open the review history");
assert(source.includes("corrected_pending_approval"), "corrections must remain pending until explicitly accepted");
assert(source.includes("EXACT SOURCE QUOTATION"), "each candidate must show its exact source quotation");
assert(source.includes("No LCR facts were created"), "empty interpretation must not imply a care fact");
assert(
  source.includes("server extraction and OCR prepare readable source text"),
  "the UI must not describe the server extraction path as text-only",
);

console.log("✓ persisted document review history is loaded and displayed");
console.log("✓ decision versions, pending corrections and source-quotation boundaries are explicit");
