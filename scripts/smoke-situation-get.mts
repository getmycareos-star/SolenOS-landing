import { getCareContextRoot, getOrCreateCareContextRoot } from "@/lib/situation-entry";

async function main() {
  const caregiverId = "test_caregiver_get";
  
  // Ensure context exists
  getOrCreateCareContextRoot(caregiverId);
  
  const context = getCareContextRoot(caregiverId);
  console.log("SUCCESS");
  console.log("has_context_root:", Boolean(context && context.events.length > 0));
  console.log("event_count:", context?.events.length ?? 0);
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
