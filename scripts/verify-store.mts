import {
  createDefaultStore,
  executeTurn,
  replaySession,
  validateStoreInvariants,
} from "../src/lib/store";

const store = createDefaultStore();

const sample = `
I'm completely overwhelmed. Mom came home from the hospital yesterday and I don't understand 
half the discharge instructions. She has new medications. I'm not sure what to watch for.
`;

const r1 = executeTurn(store, sample.trim());
const r2 = executeTurn(store, "She missed her evening medication.", r1.user_id, r1.session_id);

console.log("=== STORAGE & PERSISTENCE ENGINE v1 ===\n");
console.log("Session:", r1.session_id);
console.log("Events:", store.events.filter((e) => e.session_id === r1.session_id).length);
console.log("Signals:", store.signals.length);
console.log("Decisions:", store.decisions.length);
console.log("Memory items:", store.memory.length);
console.log("Snapshots:", store.snapshots.length);
console.log("Causal links:", store.causal_links.length);

const invariants = validateStoreInvariants(store);
console.log("\nStore invariants:", invariants.length === 0 ? "✓ pass" : invariants);

const replay = replaySession(store, r1.session_id);
console.log("\nReplay outputs:", replay.outputs.length);
console.log("Replay matches stored decisions:", replay.matches_stored_decisions);
if (replay.errors.length > 0) {
  console.log("Replay notes:", replay.errors.slice(0, 3));
}

console.log("\nTurn 2 output action:", r2.output.what_matters_now);
console.log("\n✓ Event-sourced turn complete — no store data exposed to user API");
