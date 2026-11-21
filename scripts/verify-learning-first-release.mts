import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const prompt = readFileSync(
  new URL("../src/components/mvp-workspace/UnderstandingFeedbackPrompt.tsx", import.meta.url),
  "utf8",
);
const panel = readFileSync(
  new URL("../src/components/mvp-workspace/LivingCareRecordPanel.tsx", import.meta.url),
  "utf8",
);
const productionReleaseGate = readFileSync(
  new URL("../.github/workflows/netlify-production-deploy.yml", import.meta.url),
  "utf8",
);

assert.ok(panel.includes("UnderstandingFeedbackPrompt"), "the LCR panel must expose the post-response feedback prompt");
assert.ok(prompt.includes("/api/v1/consent?person_id="), "feedback must read the authenticated caregiver's saved consent");
assert.ok(prompt.includes("consent.verified"), "feedback requires verified privacy acknowledgement");
assert.ok(prompt.includes("data_improvement_consent === true"), "feedback requires explicit improvement opt-in");
assert.ok(prompt.includes('apiUrl("/api/v1/feedback")'), "feedback must use the authenticated backend endpoint");
assert.ok(prompt.includes('"Content-Type": "application/json"'), "feedback must use a JSON request body");
assert.ok(prompt.includes("body: JSON.stringify({"), "feedback detail must not be placed in the URL");
assert.ok(!prompt.includes("/api/v1/feedback?"), "feedback text must not appear in URL query strings");
assert.ok(prompt.includes("category: \"human_validation\""), "feedback category must be explicit");
assert.ok(prompt.includes("source: \"post_response_understanding_prompt\""), "feedback provenance must be retained");
assert.ok(prompt.includes("Authorization: `Bearer ${session.access_token}`"), "feedback must use the server-issued session");
assert.ok(prompt.includes("Privacy settings"), "caregivers without opt-in must be directed to privacy settings");
assert.ok(!prompt.includes("URLSearchParams"), "feedback must not serialize sensitive detail into query parameters");
assert.ok(productionReleaseGate.includes('feedbackOperation?.requestBody?.content?.["application/json"]'), "frontend production deployment must wait for the live backend JSON feedback contract");

console.log("Learning-first feedback uses the authenticated, consent-gated backend contract.");
