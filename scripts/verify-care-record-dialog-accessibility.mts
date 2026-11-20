import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/components/app-shell/AppShell.tsx", "utf8");

assert.match(source, /recordDetailsReturnFocusRef = useRef<HTMLElement \| null>/);
assert.match(source, /role="dialog" aria-modal="true"/);
assert.match(source, /tabIndex=\{-1\}/);
assert.match(source, /recordDetailsReturnFocusRef\.current =\s*document\.activeElement instanceof HTMLElement/);
assert.match(source, /getFocusableElements\(\)\[0\]\?\.focus\(\{ preventScroll: true \}\)/);
assert.match(source, /document\.addEventListener\("keydown", handleDialogKeydown\)/);
assert.match(source, /event\.key === "Escape"/);
assert.match(source, /event\.key !== "Tab"/);
assert.match(source, /element\.inert = true/);
assert.match(source, /element\.inert = inert/);
assert.match(source, /returnFocus\.focus\(\{ preventScroll: true \}\)/);
assert.match(source, /!dialog\.contains\(active\)/);

console.log("Care record details dialog contract passed: initial focus, modal background isolation, keyboard focus containment, Escape close, and focus restoration.");
