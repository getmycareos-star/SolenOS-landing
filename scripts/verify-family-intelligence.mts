/**
 * verify-family-intelligence.mts
 *
 * Strategic Architecture facade:
 * - Types compile / stores accept+read
 * - Decision history records recommendation + outcome
 * - Crisis signals always have explanation
 * - Confidence always has explanation string
 * - Product rule module → asset mapping documented
 */

import fs from "node:fs";
import path from "node:path";
import {
  FAMILY_INTELLIGENCE_ASSETS,
  FAMILY_INTELLIGENCE_EVALUATION_QUESTION,
  FAMILY_INTELLIGENCE_IDENTITY,
  FAMILY_INTELLIGENCE_LONG_TERM_VISION,
  FAMILY_INTELLIGENCE_PRODUCT_RULE,
  TRUST_MECHANISMS,
  appendCareEvent,
  bridgeFromCareProfile,
  bridgeFromCrisisRisks,
  bridgeFromDelegationSuggestions,
  bridgeFromExplanationDecision,
  buildFamilyIntelligenceSnapshot,
  compoundAnalyzeInteraction,
  getFamilyMemory,
  getCareGraph,
  listCrisisSignals,
  listDecisionHistory,
  listDelegationNetwork,
  recordConfidenceState,
  recordCrisisSignals,
  recordDecisionOutcome,
  resetAllFamilyIntelligenceStores,
  upsertFamilyPerson,
  upsertPattern,
  upsertRelationship,
} from "../src/lib/family-intelligence";
import {
  FACADE_DEPRECATION,
  STRATEGIC_ARCHITECTURE,
  V14_ENGINE_MODULES,
  V14_PIPELINE_ACTUAL_ORDER,
} from "../src/lib/solenos-layers/architecture-map";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== SolenOS Family Intelligence (Strategic Architecture) ===\n");

assert(
  FAMILY_INTELLIGENCE_IDENTITY.includes("continuity intelligence"),
  "identity must declare continuity intelligence system",
);
assert(
  FAMILY_INTELLIGENCE_EVALUATION_QUESTION.includes("family responsibility"),
  "evaluation question required",
);
assert(
  FAMILY_INTELLIGENCE_LONG_TERM_VISION.includes("family responsibility continuity"),
  "long-term vision",
);
assert(
  FAMILY_INTELLIGENCE_PRODUCT_RULE.includes("Family Memory"),
  "product rule must list assets",
);
assert(TRUST_MECHANISMS.length === 4, "four trust mechanisms");
assert(FAMILY_INTELLIGENCE_ASSETS.length === 5, "five intelligence assets");
console.log("✓ strategic identity + product rule contracts");

assert(
  STRATEGIC_ARCHITECTURE.facadePath === "src/lib/family-intelligence",
  "architecture map facade path",
);
assert(
  STRATEGIC_ARCHITECTURE.intelligenceAssets.length === 5,
  "STRATEGIC_ARCHITECTURE must list 5 assets",
);
assert(
  STRATEGIC_ARCHITECTURE.productRuleChecklist.length >= 5,
  "product rule checklist documented",
);
assert(
  FACADE_DEPRECATION["family-intelligence"]?.includes("strategic continuity"),
  "facade deprecation maps family-intelligence",
);
const fiMod = V14_ENGINE_MODULES.find(
  (m) => m.spec === "Family Intelligence (Strategic Architecture)",
);
assert(fiMod, "V14_ENGINE_MODULES must include Family Intelligence");
assert(fiMod!.status === "implemented", "Family Intelligence implemented");
assert(
  V14_PIPELINE_ACTUAL_ORDER.some((s) => s.includes("Family Intelligence")),
  "pipeline order documents Family Intelligence compound",
);
console.log("✓ architecture map STRATEGIC_ARCHITECTURE section");

const facadeDir = path.join(root, "src/lib/family-intelligence");
for (const name of [
  "family-memory.ts",
  "care-graph.ts",
  "decision-history.ts",
  "delegation-network.ts",
  "crisis-prediction.ts",
  "trust-mechanisms.ts",
  "confidence-state.ts",
  "compound.ts",
  "index.ts",
]) {
  assert(fs.existsSync(path.join(facadeDir, name)), `missing ${name}`);
}
console.log("✓ facade module files present");

const pipelineSrc = fs.readFileSync(
  path.join(root, "src/lib/analyze-pipeline/index.ts"),
  "utf8",
);
assert(
  pipelineSrc.includes("family_intelligence_snapshot"),
  "analyze pipeline must expose family_intelligence_snapshot",
);
assert(
  pipelineSrc.includes("compoundAnalyzeInteraction"),
  "analyze pipeline must compound interactions",
);
console.log("✓ pipeline exposure wired");

resetAllFamilyIntelligenceStores();
const scope = "verify-family-intel";

upsertFamilyPerson(scope, {
  id: "p1",
  name: "Alex",
  role: "primary_caregiver",
  relationship: "self",
});
upsertFamilyPerson(scope, {
  id: "p2",
  name: "Mom",
  role: "dependent",
  relationship: "parent",
});
upsertRelationship(scope, {
  fromId: "p2",
  toId: "p1",
  kind: "depends_on",
  label: "Mom depends on Alex",
});
appendCareEvent(scope, {
  id: "e1",
  kind: "appointment",
  summary: "Neurology follow-up remembered",
  personIds: ["p2"],
  timestamp: new Date().toISOString(),
  source: "manual",
});
upsertPattern(scope, {
  id: "pat1",
  label: "Evening medication worry spikes",
  occurrenceCount: 3,
  confidence: 0.7,
  category: "operational",
  updatedAt: new Date().toISOString(),
});

const memory = getFamilyMemory(scope);
assert(memory.people.length === 2, "stores accept people");
assert(memory.relationships.length === 1, "stores accept relationships");
assert(memory.historicalEvents.length === 1, "stores accept care events");
assert(memory.recurringPatterns.length === 1, "stores accept patterns");
console.log("✓ Family Memory store accept/read");

bridgeFromCareProfile(scope, {
  roleInCareGraph: "primary_caregiver",
  careRelationships: {
    dependents: ["Dad"],
    sharedCareWith: ["Sister"],
    externalCaregivers: ["Home aide"],
  },
  conditionSignals: { medicationReminders: true, mobilityAssistance: false },
  workloadIntensity: "HIGH",
  timeSensitivity: "unpredictable",
});
assert(getFamilyMemory(scope).people.length >= 4, "care-profile bridge compounds people");
assert(getCareGraph(scope).nodes.length >= 4, "care graph nodes populated");
console.log("✓ Care Graph bridge from care-profile");

const decision = recordDecisionOutcome(scope, {
  recommendation: "Confirm medication refill today",
  accepted: true,
  outcome: "worked — refill completed without missed dose",
  decisionId: "dec-1",
  situationId: "sit-med",
});
assert(decision.recommendation.includes("refill"), "decision records recommendation");
assert(decision.accepted === true, "decision records accepted");
assert(decision.outcome.includes("worked"), "decision records outcome");
assert(listDecisionHistory(scope).length === 1, "decision history readable");

bridgeFromExplanationDecision(scope, {
  situationId: "sit-2",
  decisionId: "dec-2",
  chosenAction: "defer_noncritical",
  rejectedAlternatives: ["do_everything_now"],
  reasoningSummary: "Load HIGH — defer non-critical to protect sleep",
  assumptionsUsed: [],
  missingInfoImpact: [],
  timestamp: new Date().toISOString(),
});
assert(listDecisionHistory(scope).length === 2, "explanation bridge appends");
console.log("✓ Decision History recommendation + outcome");

const crises = recordCrisisSignals(scope, [
  {
    category: "caregiver",
    probability: 0.62,
    explanation:
      "Caregiver overload may cause missed evening medication within 24 hours if load stays CRITICAL.",
  },
]);
assert(crises[0]!.explanation.trim().length > 0, "crisis signal has explanation");
assert(listCrisisSignals(scope).length === 1, "crisis signals readable");

let bareScoreBlocked = false;
try {
  recordCrisisSignals(scope, [{ category: "medical", probability: 0.9, explanation: "" }]);
} catch {
  bareScoreBlocked = true;
}
assert(bareScoreBlocked, "bare crisis probability without explanation must throw");

bridgeFromCrisisRisks(scope, [
  {
    situationId: "sit-med",
    probability: 0.4,
    estimatedTimeToFailure: 36,
    contributingFactors: ["time window narrowing"],
    explanation: "Medication refill could become critical within the next day or two.",
    category: "medical",
  },
]);
assert(
  listCrisisSignals(scope).every((s) => s.explanation.trim().length > 0),
  "all crisis signals have explanations",
);
console.log("✓ Crisis signals require causal explanation");

const conf = recordConfidenceState(scope, {
  confidence: 78,
  explanation: "No critical actions are currently overdue.",
});
assert(typeof conf.explanation === "string" && conf.explanation.length > 0, "confidence explanation");

let bareConfBlocked = false;
try {
  recordConfidenceState(scope, { confidence: 90, explanation: "   " });
} catch {
  bareConfBlocked = true;
}
assert(bareConfBlocked, "bare confidence without explanation must throw");
console.log("✓ Confidence always has explanation string");

bridgeFromDelegationSuggestions(
  scope,
  [
    {
      task: "Pharmacy pickup",
      recommendedPerson: "Sister",
      reason: "Sister has lighter load",
      loadReductionEstimate: 12,
    },
  ],
  "Alex",
);
const dels = listDelegationNetwork(scope);
assert(dels.length === 1, "delegation network records suggestion");
assert(dels[0]!.delegatedTo === "Sister", "delegation tracks delegatedTo");
assert(typeof dels[0]!.successRate === "number", "delegation tracks successRate");
console.log("✓ Delegation Network compounding");

const snapshot = compoundAnalyzeInteraction({
  scopeId: scope,
  careProfile: {
    roleInCareGraph: "primary_caregiver",
    careRelationships: {
      dependents: ["Mom"],
      sharedCareWith: ["Sister"],
      externalCaregivers: [],
    },
    conditionSignals: { medicationReminders: true, mobilityAssistance: false },
    workloadIntensity: "HIGH",
    timeSensitivity: "unpredictable",
  },
  crisisRisks: [
    {
      situationId: "sit-x",
      probability: 0.55,
      estimatedTimeToFailure: 18,
      contributingFactors: ["burnout"],
      explanation: "Burnout risk may lead to missed care within 24 hours.",
      category: "caregiver",
    },
  ],
  confidence: {
    confidence: 71,
    missingCriticalActions: 0,
    unresolvedHighRiskSituations: 0,
    explanation: "No critical actions are currently overdue.",
  },
  careEventSummary: "analyze: confirm_refill",
});

assert(snapshot.familyMemory.people.length > 0, "snapshot has family memory");
assert(snapshot.confidence?.explanation, "snapshot confidence explained");
assert(snapshot.trust.remember.active || snapshot.trust.explain.active, "trust hooks fire");
assert(
  snapshot.crisisSignals.every((s) => s.explanation.trim().length > 0),
  "snapshot crises explained",
);
assert(snapshot.assetsImprovedThisTurn.length > 0, "compounding reports assets improved");

const readBack = buildFamilyIntelligenceSnapshot(scope);
assert(readBack.decisionHistory.length >= 2, "accumulated decision history persists in memory");
console.log("✓ Compounding + FamilyIntelligenceSnapshot");

// Product rule: document which modules map to which asset
console.log("\n── Product rule module → asset map ──");
for (const row of STRATEGIC_ARCHITECTURE.productRuleChecklist) {
  console.log(`  • ${row.module} → ${row.improves}`);
}
for (const asset of STRATEGIC_ARCHITECTURE.intelligenceAssets) {
  assert(asset.existingPaths.length > 0, `${asset.asset} must bridge existing paths`);
  assert(
    asset.gapStatus === "bridged" || asset.gapStatus === "bridged_extended",
    `${asset.asset} gap status`,
  );
  console.log(
    `  ✓ ${asset.asset}: ${asset.existingPaths.join(" + ")} [${asset.gapStatus}]`,
  );
}

console.log("\n=== Family Intelligence verify PASSED ===\n");
