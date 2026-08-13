import { composeReliefFollowUps } from "@/lib/care-reality-output";

const result = composeReliefFollowUps({
  heldFocus: "Morning confusion",
  topUnknown: null,
  decisionWhyUnknown: false,
});

console.log("RESULT:", JSON.stringify(result, null, 2));
console.log("MATCH:", result.some((i) => /Notice whether "Morning confusion"/i.test(i)));
