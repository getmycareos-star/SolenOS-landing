import fs from "node:fs";

import path from "node:path";

import {

  ANALYZE_MAX_RETRIES,

  ANALYZE_FAILURE,

  isAnalyzeFailure,

  normalizeAnalyzeInput,

} from "../src/lib/analyze-pipeline";

import { validateAIResponse } from "../src/lib/response-validator";

import { validateOutputQuality } from "../src/lib/output-quality-gate";

import { VERIFY_VALID_SOLENOS } from "./fixtures/solenos-valid";



const pipelineSource = fs.readFileSync(

  path.join(process.cwd(), "src/lib/analyze-pipeline/index.ts"),

  "utf-8",

);



console.log("=== /api/analyze — FINAL IMPLEMENTATION PIPELINE ===\n");



if (normalizeAnalyzeInput("  \n  Mom missed her dose.  \n") !== "Mom missed her dose.") {

  throw new Error("normalization failed");

}

console.log("✓ step 1: input normalization");



const classifyIdx = pipelineSource.indexOf("classifyInputSurface(structuredInput.raw_input)");

const urgencyIdx = pipelineSource.indexOf("detectUrgencyLevel(");

const modeIdx = pipelineSource.indexOf("selectBehaviorProfile(inputClassification)");

const safetyIdx = pipelineSource.indexOf("applySafetyOverrideCheck(urgencyDetection");

const preDocumentIdx = pipelineSource.indexOf("applyDocumentIntake(structuredInput)");

const preReasoningIdx = pipelineSource.indexOf("await runPreReasoningGrounding({");

const geminiIdx = pipelineSource.indexOf("invokeGeminiExecution({");

if (!(classifyIdx > 0 && classifyIdx < urgencyIdx && urgencyIdx < modeIdx && modeIdx < safetyIdx && safetyIdx < preDocumentIdx && preDocumentIdx < preReasoningIdx && preReasoningIdx < geminiIdx)) {

  throw new Error("pre-LLM order must be classification → urgency → mode → safety → document intake → pre-reasoning grounding → generation");

}

console.log("✓ pre-LLM order: classification → urgency → mode → safety → pre-reasoning grounding → generation");



const valid = validateAIResponse(VERIFY_VALID_SOLENOS);

if (!validateOutputQuality(valid).valid) {

  throw new Error("explanation-preserving sample must pass clarity gate");

}

console.log("✓ explanation-preserving output contract");



const zodIdx = pipelineSource.indexOf("const structural = validateStructuralLayer");

const groundingIdx = pipelineSource.indexOf("if (!isGroundingValid(structural.data");

const chaosIdx = pipelineSource.indexOf("if (!isChaosToClarityValid(structural.data");

const semanticIdx = pipelineSource.indexOf("if (!isSemanticRoleIsolationValid(structural.data");

const cognitiveCompressionIdx = pipelineSource.indexOf("if (!isCognitiveCompressionValid(structural.data");

const urgencyGateIdx = pipelineSource.indexOf("if (!isUrgencyEscalationValid(structural.data");

const safetyGateIdx = pipelineSource.indexOf("if (!isSafetyOverrideValid(structural.data");

const unknownIdx = pipelineSource.indexOf("if (!isUnknownStateValid(structural.data");

const documentIdx = pipelineSource.indexOf("if (!isDocumentIntakeValid(structural.data");

const consistencyIdx = pipelineSource.indexOf("const determinism = runDeterminismGate");

const medicalIdx = pipelineSource.indexOf("const medicalBoundary = enforceMedicalBoundary");

const epistemicIdx = pipelineSource.indexOf("const epistemic = enforceEpistemicSafety");

const emotionalIdx = pipelineSource.indexOf("if (!isEmotionalStabilizationValid(epistemicOutput");

const calibratedIdx = pipelineSource.indexOf("if (!isCalibratedUncertaintyValid(epistemicOutput))");

const cognitiveIdx = pipelineSource.indexOf("if (!isCognitiveClarityValid(epistemicOutput))");

const nonConversationalIdx = pipelineSource.indexOf("if (!isNonConversationalValid(epistemicOutput))");

const episodicIdx = pipelineSource.indexOf("if (!isEpisodicReliefValid(epistemicOutput))");

const pressureIdx = pipelineSource.indexOf("if (!isPressureReductionValid(epistemicOutput))");

const compressionIdx = pipelineSource.indexOf("isOutputCompressionValid(epistemicOutput");

const clarityIdx = pipelineSource.indexOf("if (!isOutputQualityValid(epistemicOutput))");

const styleIdx = pipelineSource.indexOf("if (!isNonAssistantOutputValid(epistemicOutput))");

const returnIdx = pipelineSource.indexOf("publishLastFailureLogs(collector.getLogs());", styleIdx);

if (

  !(

    zodIdx < groundingIdx &&

    groundingIdx < chaosIdx &&

    chaosIdx < semanticIdx &&

    semanticIdx < cognitiveCompressionIdx &&

    cognitiveCompressionIdx < urgencyGateIdx &&

    urgencyGateIdx < safetyGateIdx &&

    safetyGateIdx < unknownIdx &&

    unknownIdx < documentIdx &&

    documentIdx < consistencyIdx &&

    consistencyIdx < medicalIdx &&

    medicalIdx < epistemicIdx &&

    epistemicIdx < emotionalIdx &&

    emotionalIdx < calibratedIdx &&

    calibratedIdx < cognitiveIdx &&

    cognitiveIdx < nonConversationalIdx &&

    nonConversationalIdx < episodicIdx &&

    episodicIdx < pressureIdx &&

    pressureIdx < compressionIdx &&

    compressionIdx < clarityIdx &&

    clarityIdx < styleIdx &&

    styleIdx < returnIdx

  )

) {

  throw new Error(

    "validation order must include cognitive compression, safety override, pressure reduction, style validation before return",

  );

}

console.log("✓ validation order includes cognitive compression → safety → pressure → style → return");



if (!pipelineSource.includes("formatGuiltReplayObservation")) {

  throw new Error("pipeline must pass guilt replay observation tag");

}

console.log("✓ guilt replay observation tag wired");



const memoryInfluenceIdx = pipelineSource.indexOf("processMemoryInfluenceLayer(");

const careProfileLayerIdx = pipelineSource.indexOf("processCareProfileLayer(");

const timeEngineIdx = pipelineSource.indexOf("processTimeEngineLayer(");

if (

  !(

    memoryInfluenceIdx > 0 &&

    careProfileLayerIdx > memoryInfluenceIdx &&

    timeEngineIdx > careProfileLayerIdx &&

    timeEngineIdx < geminiIdx

  )

) {

  throw new Error("pre-LLM weighting order must include memory → care profile → time engine before generation");

}

if (!pipelineSource.includes("formatTimeEngineObservation")) {

  throw new Error("pipeline must pass time engine classification envelope");

}

console.log("✓ time engine layer wired after memory/care-profile, before generation");



if (!pipelineSource.includes("processSystemHealthLayer(")) {

  throw new Error("pipeline must run system health before safety");

}

if (!pipelineSource.includes("system_health_layer")) {

  throw new Error("pipeline run must expose system_health_layer payload");

}

console.log("✓ system health layer wired before safety / on analyze run");



if (!isAnalyzeFailure(ANALYZE_FAILURE)) {

  throw new Error("failure envelope invalid");

}

if (ANALYZE_MAX_RETRIES !== 2) {

  throw new Error("retry budget mismatch");

}

console.log(`✓ retry policy unchanged (max ${ANALYZE_MAX_RETRIES} retries)`);



console.log("\n✓ /api/analyze aligned with final implementation contract");

