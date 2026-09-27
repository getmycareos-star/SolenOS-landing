import { extractWithRules } from "../src/lib/semantic-extraction/rule-extractor";

const t = "I just feel like I'm drowning. Everything is on me.";
console.time("extract");
const r = extractWithRules(t);
console.timeEnd("extract");
console.log(JSON.stringify(r, null, 2));
