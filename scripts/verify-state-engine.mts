import { analyzeRawText } from "../src/lib/engine";

const sample = `
I'm completely overwhelmed. Mom came home from the hospital yesterday and I don't understand 
half the discharge instructions. She has new medications and my sister thinks I'm doing 
everything wrong. I'm terrified I'm missing something important.
`;

const { clarity, trace } = analyzeRawText(sample.trim(), "message");

console.log("=== STATE PIPELINE ===\n");
console.log(`INTERPRETED: uncertain=${trace.interpreted.uncertain_elements}`);
console.log(`COGNITIVE_LOAD: ${trace.cognitive_load.load_level} — ${trace.cognitive_load.why}`);
console.log(`PRIORITY: ${trace.priority.classification}`);
console.log(`ACTIONS do_now: ${trace.actions.actions.do_now.length}`);
console.log("\n=== CLARITY OUTPUT (contract) ===\n");
console.log(JSON.stringify(clarity.output, null, 2));
