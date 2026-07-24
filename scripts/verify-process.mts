import { process, createInitialState } from "../src/lib/process";

const sample = `
I'm completely overwhelmed. Mom came home from the hospital yesterday and I don't understand 
half the discharge instructions. She has new medications. I'm not sure what to watch for.
`;

let state = createInitialState();
const r1 = process(sample.trim(), state);
state = r1.new_state;

console.log("=== process() — BUILD SPEC v1 ===\n");
console.log("Turn 1 output:");
console.log(JSON.stringify(r1.output, null, 2));

const r2 = process("She missed her evening medication.", state);
console.log("\nTurn 2 output:");
console.log(JSON.stringify(r2.output, null, 2));

const r3 = process("oxygen is 88 and he looks tired", createInitialState());
console.log("\nOxygen scenario:");
console.log(JSON.stringify(r3.output, null, 2));

const r4 = process("hi", createInitialState());
console.log("\nAmbiguous (SAFE MODE):");
console.log(JSON.stringify(r4.output, null, 2));

console.log("\n✓ Structured output with decision_trace");
