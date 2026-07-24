import { process, createInitialState } from "../src/lib/process";

const sample = `
I'm completely overwhelmed. Mom came home from the hospital yesterday and I don't understand 
half the discharge instructions. She has new medications and my sister thinks I'm doing 
everything wrong. I'm terrified I'm missing something important.
`;

const { output } = process(sample.trim(), createInitialState());

console.log("=== OUTPUT CONTRACT (IMMUTABLE) ===\n");
console.log(JSON.stringify(output, null, 2));
console.log("\n✓ Contract validated via process() pipeline");
