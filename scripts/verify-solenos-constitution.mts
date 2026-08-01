#!/usr/bin/env tsx
/**
 * verify-solenos-constitution.mts
 *
 * Verifies the SolenOS AI Constitution implementation:
 * - Phase 1: Constitution document exists
 * - Phase 2: Runtime constitution module types and helpers
 * - Phase 3: Prompt fragments and builder methods
 * - Phase 4: LLM prompt integration
 * - Phase 5: Constitution-aware understanding
 * - Phase 6: TypeScript compilation (run separately)
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

console.log("=== SolenOS AI Constitution Verification ===\n");

// ─── Phase 1: Constitution Document ──────────────────────────────────────

console.log("Phase 1: Constitution Document");
const constitutionDocPath = resolve("docs/SOLENOS_AI_CONSTITUTION.md");
assert.ok(existsSync(constitutionDocPath), "Constitution document must exist");
const docContent = readFileSync(constitutionDocPath, "utf-8");
assert.ok(docContent.includes("SolenOS AI Constitution"), "Document must contain title");
assert.ok(docContent.includes("Identity"), "Document must contain Identity section");
assert.ok(docContent.includes("Knowledge Hierarchy"), "Document must contain Knowledge Hierarchy");
assert.ok(docContent.includes("General Knowledge Policy"), "Document must contain General Knowledge Policy");
assert.ok(docContent.includes("Conversation Drift Policy"), "Document must contain Conversation Drift Policy");
console.log("  ✓ docs/SOLENOS_AI_CONSTITUTION.md exists and contains all required sections\n");

// ─── Phase 2: Runtime Constitution Module ────────────────────────────────

console.log("Phase 2: Runtime Constitution Module");

// Verify module files exist
assert.ok(existsSync(resolve("src/lib/solenos-constitution/types.ts")), "types.ts must exist");
assert.ok(existsSync(resolve("src/lib/solenos-constitution/constitution.ts")), "constitution.ts must exist");
assert.ok(existsSync(resolve("src/lib/solenos-constitution/index.ts")), "index.ts must exist");
console.log("  ✓ All constitution module files exist");

// Verify imports work
const { SOLENOS_CONSTITUTION } = await import("../src/lib/solenos-constitution/index.ts");
const {
  dependsOnLivingCareRecord,
  isGeneralKnowledgeType,
  detectCareIntelligenceSignal,
  classifyQuestionType,
  estimateConfidence,
  isNoiseForMemory,
  getKnowledgeLevelLabel,
  detectDecisionType,
} = await import("../src/lib/solenos-constitution/index.ts");

// Verify constitution object
assert.ok(SOLENOS_CONSTITUTION.version === "1.0.0", "Version must be 1.0.0");
assert.ok(SOLENOS_CONSTITUTION.identity.length > 0, "Identity must be non-empty");
assert.ok(SOLENOS_CONSTITUTION.mission.length >= 6, "Mission must have at least 6 items");
assert.ok(SOLENOS_CONSTITUTION.thinking_steps.length === 4, "Must have 4 thinking steps");
assert.ok(SOLENOS_CONSTITUTION.question_types.length >= 13, "Must have at least 13 question types");
assert.ok(Object.keys(SOLENOS_CONSTITUTION.knowledge_hierarchy).length >= 5, "Knowledge hierarchy must have 5 levels");
assert.ok(SOLENOS_CONSTITUTION.general_knowledge_policy.length >= 4, "General knowledge policy must have rules");
assert.ok(SOLENOS_CONSTITUTION.care_intelligence_signals.length >= 12, "Must have at least 12 care signals");
assert.ok(SOLENOS_CONSTITUTION.missing_information_policy.length >= 4, "Missing info policy must have rules");
assert.ok(SOLENOS_CONSTITUTION.pattern_dimensions.length >= 8, "Must have at least 8 pattern dimensions");
assert.ok(SOLENOS_CONSTITUTION.decision_types.length >= 6, "Must have at least 6 decision types");
assert.ok(SOLENOS_CONSTITUTION.memory_policy.remember.length >= 9, "Must remember at least 9 categories");
assert.ok(SOLENOS_CONSTITUTION.memory_policy.forget.length >= 1, "Must forget at least 1 category");
assert.ok(SOLENOS_CONSTITUTION.truthfulness_categories.length >= 5, "Must have at least 5 truth categories");
assert.ok(SOLENOS_CONSTITUTION.safety_boundary.length >= 4, "Safety boundary must have at least 4 rules");
assert.ok(SOLENOS_CONSTITUTION.success_metrics.length >= 6, "Must have at least 6 success metrics");
console.log("  ✓ SOLENOS_CONSTITUTION object has correct structure");

// Test helper functions
assert.ok(dependsOnLivingCareRecord("living_care_record") === true, "living_care_record depends on record");
assert.ok(dependsOnLivingCareRecord("care_decision") === true, "care_decision depends on record");
assert.ok(dependsOnLivingCareRecord("general_knowledge") === false, "general_knowledge does not depend on record");
assert.ok(dependsOnLivingCareRecord("creative_task") === false, "creative_task does not depend on record");

assert.ok(isGeneralKnowledgeType("general_knowledge") === true, "general_knowledge is general type");
assert.ok(isGeneralKnowledgeType("creative_task") === true, "creative_task is general type");
assert.ok(isGeneralKnowledgeType("care_decision") === false, "care_decision is not general type");

assert.ok(detectCareIntelligenceSignal("I noticed mom is more confused today") === "new_observation", "Should detect new_observation");
assert.ok(detectCareIntelligenceSignal("She usually takes a walk in the morning") === "new_baseline", "Should detect new_baseline");
assert.ok(detectCareIntelligenceSignal("The doctor prescribed a new medication") === "medication", "Should detect medication");
assert.ok(detectCareIntelligenceSignal("What is a cat?") === null, "Should not detect care signal in general query");

assert.ok(classifyQuestionType("911 emergency") === "emergency", "Should classify emergency");
assert.ok(classifyQuestionType("Should I call the doctor?") === "care_decision", "Should classify care_decision");
assert.ok(classifyQuestionType("What is dementia?") === "general_dementia_knowledge", "Should classify dementia knowledge");
assert.ok(classifyQuestionType("What is a cat?") === "general_knowledge", "Should classify general knowledge");

assert.ok(estimateConfidence({ hasCareRecord: false, eventCount: 0, uncertaintyCount: 0, hasPriorContext: false }) === "unknown", "No data = unknown");
assert.ok(estimateConfidence({ hasCareRecord: true, eventCount: 3, uncertaintyCount: 0, hasPriorContext: true }) === "high", "3 events + record = high");
assert.ok(estimateConfidence({ hasCareRecord: true, eventCount: 1, uncertaintyCount: 0, hasPriorContext: false }) === "low", "1 event no context = low");

assert.ok(isNoiseForMemory("hello") === true, "Greeting is noise");
assert.ok(isNoiseForMemory("What is a cat?") === true, "General knowledge question is noise");
assert.ok(isNoiseForMemory("Mom fell today") === false, "Care observation is not noise");

assert.ok(getKnowledgeLevelLabel(1).includes("Living Care Record"), "Level 1 label correct");
assert.ok(getKnowledgeLevelLabel(5).includes("Reasoned inference"), "Level 5 label correct");

assert.ok(detectDecisionType("Should I call the doctor?") === "call_clinician", "Should detect call_clinician decision");
assert.ok(detectDecisionType("I need to watch her more closely") === "monitor", "Should detect monitor decision");
assert.ok(detectDecisionType("What is gravity?") === null, "Should not detect decision in general query");

console.log("  ✓ All constitution helper functions work correctly\n");

// ─── Phase 3: Prompt Fragments ───────────────────────────────────────────

console.log("Phase 3: Prompt Fragments");
const { PromptBuilder, PROMPT_REGISTRY } = await import("../src/intelligence/prompt-builder.ts");

// Verify registry has constitution fragments
const registryKeys = Object.keys(PROMPT_REGISTRY.fragments) as Array<keyof typeof PROMPT_REGISTRY.fragments>;
assert.ok(registryKeys.includes("constitution_identity"), "Registry must have constitution_identity");
assert.ok(registryKeys.includes("constitution_thinking_model"), "Registry must have constitution_thinking_model");
assert.ok(registryKeys.includes("constitution_knowledge_hierarchy"), "Registry must have constitution_knowledge_hierarchy");
assert.ok(registryKeys.includes("constitution_general_knowledge_policy"), "Registry must have constitution_general_knowledge_policy");
assert.ok(registryKeys.includes("constitution_transition_policy"), "Registry must have constitution_transition_policy");
assert.ok(registryKeys.includes("constitution_care_intelligence"), "Registry must have constitution_care_intelligence");
assert.ok(registryKeys.includes("constitution_missing_information"), "Registry must have constitution_missing_information");
assert.ok(registryKeys.includes("constitution_pattern_recognition"), "Registry must have constitution_pattern_recognition");
assert.ok(registryKeys.includes("constitution_decision_support"), "Registry must have constitution_decision_support");
assert.ok(registryKeys.includes("constitution_memory_policy"), "Registry must have constitution_memory_policy");
assert.ok(registryKeys.includes("constitution_conversation_drift"), "Registry must have constitution_conversation_drift");
assert.ok(registryKeys.includes("constitution_truthfulness"), "Registry must have constitution_truthfulness");
assert.ok(registryKeys.includes("constitution_safety_boundary"), "Registry must have constitution_safety_boundary");
assert.ok(registryKeys.includes("constitution_success_metric"), "Registry must have constitution_success_metric");
console.log("  ✓ PROMPT_REGISTRY contains all 14 constitution fragments");

// Test builder methods
const builder = new PromptBuilder();

// Test individual constitution builder methods
const identityBuilder = new PromptBuilder().withConstitutionIdentity();
assert.ok(identityBuilder["selectedFragments"].length === 1, "withConstitutionIdentity adds 1 fragment");
assert.ok(identityBuilder["selectedFragments"][0].id === "constitution_identity_v1", "Fragment id must match");

const fullBuilder = new PromptBuilder().withConstitution();
// withConstitution adds 14 fragments
const constitutionCount = fullBuilder["selectedFragments"].filter(
  (f: { id: string }) => f.id.startsWith("constitution_"),
).length;
assert.ok(constitutionCount === 14, `withConstitution adds all 14 constitution fragments (got ${constitutionCount})`);

// Test building with constitution fragments
const composed = new PromptBuilder()
  .withConstitutionIdentity()
  .withThinkingModel()
  .withKnowledgeHierarchy()
  .withGeneralKnowledgePolicy()
  .withConversationDriftPolicy()
  .build();

assert.ok(composed.system.length > 0, "Composed prompt must have content");
assert.ok(composed.fragments.length === 5, "Composed prompt must have 5 fragments");
assert.ok(composed.version === "1.0.0", "Version must be 1.0.0");
assert.ok(composed.system.includes("SolenOS"), "Composed prompt must include SolenOS identity");
assert.ok(composed.system.includes("Step 1"), "Composed prompt must include thinking model");
assert.ok(composed.system.includes("Level 1"), "Composed prompt must include knowledge hierarchy");
assert.ok(composed.system.includes("Users may ask absolutely anything"), "Composed prompt must include general knowledge policy");
assert.ok(composed.system.includes("Conversation drift"), "Composed prompt must include conversation drift");

console.log("  ✓ PromptBuilder constitution methods work correctly");
console.log("  ✓ withConstitution() adds all 14 fragments\n");

// ─── Phase 4: LLM Prompt Integration ────────────────────────────────────

console.log("Phase 4: LLM Prompt Integration");
const { CARE_UNDERSTANDING_LLM_SYSTEM_PROMPT: llmPrompt } = await import("../src/lib/care-situation-understanding/llm-prompt.ts");

assert.ok(llmPrompt.includes("CONSTITUTION PRINCIPLES"), "LLM prompt must contain constitution principles section");
assert.ok(llmPrompt.includes("IDENTITY:"), "LLM prompt must contain identity section");
assert.ok(llmPrompt.includes("CORE MISSION:"), "LLM prompt must contain core mission");
assert.ok(llmPrompt.includes("KNOWLEDGE HIERARCHY:"), "LLM prompt must contain knowledge hierarchy");
assert.ok(llmPrompt.includes("GENERAL KNOWLEDGE POLICY:"), "LLM prompt must contain general knowledge policy");
assert.ok(llmPrompt.includes("CONVERSATION DRIFT POLICY:"), "LLM prompt must contain conversation drift policy");
assert.ok(llmPrompt.includes("END CONSTITUTION PRINCIPLES"), "LLM prompt must end constitution section");
assert.ok(llmPrompt.includes("You are SolenOS"), "LLM prompt must include SolenOS identity");
assert.ok(llmPrompt.includes("Never reverse this order"), "LLM prompt must include knowledge hierarchy rule");
assert.ok(llmPrompt.includes("Do not refuse"), "LLM prompt must include general knowledge rule");
assert.ok(llmPrompt.includes("Never lose continuity"), "LLM prompt must include conversation drift rule");

console.log("  ✓ LLM prompt includes all constitution principles\n");

// ─── Phase 5: Constitution-Aware Understanding ───────────────────────────

console.log("Phase 5: Constitution-Aware Understanding");
const constitutionModule = await import("../src/lib/solenos-constitution/index.ts");
const understandingModule = await import("../src/lib/care-situation-understanding/llm-understanding.ts");

// Check that constitution functions are imported in llm-understanding
const fileContent = readFileSync(resolve("src/lib/care-situation-understanding/llm-understanding.ts"), "utf-8");
assert.ok(fileContent.includes("classifyQuestionType"), "llm-understanding must import classifyQuestionType");
assert.ok(fileContent.includes("estimateConfidence"), "llm-understanding must import estimateConfidence");
assert.ok(fileContent.includes("detectCareIntelligenceSignal"), "llm-understanding must import detectCareIntelligenceSignal");
assert.ok(fileContent.includes("dependsOnLivingCareRecord"), "llm-understanding must import dependsOnLivingCareRecord");
assert.ok(fileContent.includes("Constitution analysis"), "llm-understanding must log constitution analysis");
assert.ok(fileContent.includes("questionType="), "llm-understanding must include questionType in log");

assert.ok(typeof understandingModule.llmStructuredUnderstanding === "function", "llmStructuredUnderstanding must be exported");
assert.ok(typeof understandingModule.deterministicUnderstanding === "function", "deterministicUnderstanding must be exported");

console.log("  ✓ llm-understanding imports and uses constitution functions\n");

// ─── Summary ─────────────────────────────────────────────────────────────

console.log("=== Summary ===");
console.log("Phase 1: Constitution Document     ✓");
console.log("Phase 2: Runtime Module            ✓");
console.log("Phase 3: Prompt Fragments          ✓");
console.log("Phase 4: LLM Prompt Integration    ✓");
console.log("Phase 5: Constitution Awareness    ✓");
console.log("\nAll SolenOS AI Constitution phases verified successfully!");
