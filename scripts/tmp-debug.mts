import { extractWithRules } from "../src/lib/semantic-extraction/rule-extractor";

const t = "I just feel like I'm drowning. Everything is on me.";
console.log(JSON.stringify(extractWithRules(t), null, 2));
