import { testAsync, testSync } from "./src/lib/situation-entry/pipeline";

async function test() {
  console.log("Testing sync...");
  const syncResult = testSync();
  console.log("Sync result:", syncResult);
  
  console.log("Testing async...");
  const asyncResult = await testAsync();
  console.log("Async result:", asyncResult);
}

test().catch(console.error);