import { stressNormalizeInput } from "../src/lib/input-stress-normalizer";

import {

  detectHighUrgencySignals,

  hasHighUrgencySignals,

  isUrgencyEscalationValid,

  URGENCY_ESCALATION_FAILURE_MODEL,

  URGENCY_ESCALATION_IDENTITY,

  URGENCY_SAFETY_PRINCIPLE,

  validateUrgencyEscalation,

} from "../src/lib/urgency-escalation";

import { detectUrgencyLevel } from "../src/lib/urgency-detection";

import { validateAIResponse } from "../src/lib/response-validator";

import {

  classifyUrgencyEscalationFailure,

  FailureLogEntrySchema,

} from "../src/lib/failure-observability";

import { SOLENOS_SYSTEM_PROMPT } from "../src/lib/solenos-langchain-adapter/system-prompt";

import { VERIFY_VALID_SOLENOS } from "./fixtures/solenos-valid";



console.log("=== Urgency Detection + Emergency Escalation Contract ===\n");



if (!SOLENOS_SYSTEM_PROMPT.includes("SAFETY OVERRIDE")) {

  throw new Error("system prompt missing safety override section");

}

if (!SOLENOS_SYSTEM_PROMPT.includes("🔴 CRITICAL")) {

  throw new Error("system prompt missing CRITICAL header format");

}

console.log("✓ urgency escalation rules in system prompt");



if (!hasHighUrgencySignals("Mom has chest pain and cannot breathe.")) {

  throw new Error("chest pain + cannot breathe must trigger high urgency detection");

}

if (hasHighUrgencySignals("Mom missed her evening medication.")) {

  throw new Error("non-emergency input must not trigger high urgency detection");

}

console.log("✓ signal-based high urgency detection");



const notBreathing = detectUrgencyLevel("She is not breathing");

if (notBreathing.risk_level !== "critical") {
  throw new Error("not breathing must detect critical tier");
}
console.log("✓ critical tier detection");



const neutralInput = stressNormalizeInput("Mom missed her evening medication.");

const neutralOutput = validateAIResponse(VERIFY_VALID_SOLENOS);

if (!isUrgencyEscalationValid(neutralOutput, neutralInput)) {

  throw new Error("non-urgent input/output must pass urgency gate");

}

console.log("✓ non-urgent scenarios pass urgency gate");



const emergencyInput = stressNormalizeInput(

  "Dad has chest pain and difficulty breathing — he looks pale and I don't know what to do.",

);



const validEmergency = validateAIResponse({

  ...VERIFY_VALID_SOLENOS,

  what_is_happening:

    "The input reports chest pain and difficulty breathing, which may require urgent medical evaluation.",

  what_matters_now:

    "🔴 CRITICAL — Seek emergency medical care immediately. Contact emergency services if symptoms are severe or worsening. Do not delay professional evaluation.",

  what_to_ask_next: "Is emergency help already being contacted?",

  risk_level: "critical",

  what_can_wait: "Further interpretation can wait until emergency care is engaged.",

});



const missingEscalation = validateAIResponse({

  ...VERIFY_VALID_SOLENOS,

  what_is_happening: "The input reports chest pain and difficulty breathing.",

});



const suppressed = validateAIResponse({

  ...validEmergency,

  what_is_happening:

    "Chest pain can sometimes be indigestion, but the input also reports difficulty breathing.",

});



const diagnostic = validateAIResponse({

  ...validEmergency,

  what_is_happening: "This is a heart attack based on the symptoms described.",

});



if (!isUrgencyEscalationValid(validEmergency, emergencyInput)) {

  throw new Error(

    `valid emergency escalation must pass: ${validateUrgencyEscalation(validEmergency, emergencyInput).violations.join(",")}`,

  );

}

console.log("✓ high urgency input requires proper escalation format");



if (isUrgencyEscalationValid(missingEscalation, emergencyInput)) {

  throw new Error("missing escalation on high urgency input must fail");

}

console.log("✓ blocks missing escalation when severe signals present");



if (isUrgencyEscalationValid(suppressed, emergencyInput)) {

  throw new Error("urgency suppression must fail");

}

console.log("✓ blocks urgency suppression patterns");



if (isUrgencyEscalationValid(diagnostic, emergencyInput)) {

  throw new Error("diagnostic certainty in urgency must fail");

}

console.log("✓ blocks diagnostic certainty during urgency escalation");



const detection = detectHighUrgencySignals("She collapsed and is unconscious.");

if (!detection.high_urgency) {

  throw new Error("collapse + unconscious must match high urgency signals");

}

console.log("✓ detects collapse and unconsciousness signals");



FailureLogEntrySchema.parse({

  timestamp: new Date().toISOString(),

  stage: "postprocess",

  failure_type: classifyUrgencyEscalationFailure().failure_type,

  retry_count: 0,

});

console.log("✓ URGENCY_ESCALATION_FAILURE logged via observability");



console.log(`\n✓ ${URGENCY_ESCALATION_FAILURE_MODEL}`);

console.log(`✓ ${URGENCY_SAFETY_PRINCIPLE}`);

console.log(`✓ ${URGENCY_ESCALATION_IDENTITY}`);

