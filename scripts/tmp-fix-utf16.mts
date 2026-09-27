import fs from "node:fs";

const p = "src/lib/semantic-extraction/reasoning-engine.ts";
const raw = fs.readFileSync(p);
const text = raw.toString("utf16le").replace(/^﻿/, "");
fs.writeFileSync(p, text, "utf8");
const after = fs.readFileSync(p);
console.log("before bytes:", raw.length, "after bytes:", after.length);
console.log("starts with:", JSON.stringify(after.subarray(0, 24).toString("utf8")));
console.log("line count:", text.split("\n").length);
