/**
 * Family Intelligence — strategic continuity facade.
 * Unifies 5 proprietary assets without replacing existing modules.
 */

export const FAMILY_INTELLIGENCE_IDENTITY =
  "SolenOS IS a continuity intelligence system — NOT a task manager, reminder app, or caregiving dashboard.";

export const FAMILY_INTELLIGENCE_PRIMARY_ASSET =
  "accumulated family intelligence (compounding value over time)";

export const FAMILY_INTELLIGENCE_EVALUATION_QUESTION =
  "Does this increase SolenOS' understanding of the family responsibility system over time?";

export const FAMILY_INTELLIGENCE_LONG_TERM_VISION =
  "OS for family responsibility continuity";

export const FAMILY_INTELLIGENCE_PRODUCT_RULE =
  "Every feature must improve at least one of: Family Memory, Care Graph, Decision History, Delegation Network, Crisis Prediction, User Trust, Confidence Engine.";

/** Five strategic moat assets → existing implementation bridges. */
export const FAMILY_INTELLIGENCE_ASSETS = [
  {
    asset: "Family Memory Layer",
    strategicType: "FamilyMemory",
    facadePath: "src/lib/family-intelligence/family-memory.ts",
    existingPaths: [
      "src/lib/care-profile",
      "src/lib/memory-influence",
      "src/lib/observation-intelligence",
    ],
    improves: ["Family Memory", "User Trust"] as const,
  },
  {
    asset: "Care Graph",
    strategicType: "CareGraph",
    facadePath: "src/lib/family-intelligence/care-graph.ts",
    existingPaths: ["src/lib/responsibility-graph", "src/lib/care-profile"],
    improves: ["Care Graph", "User Trust"] as const,
  },
  {
    asset: "Decision History Layer",
    strategicType: "DecisionHistory",
    facadePath: "src/lib/family-intelligence/decision-history.ts",
    existingPaths: [
      "src/lib/decision-history",
      "src/lib/solenos-layers/explanation",
    ],
    improves: ["Decision History", "User Trust"] as const,
  },
  {
    asset: "Delegation Network Layer",
    strategicType: "DelegationNetwork",
    facadePath: "src/lib/family-intelligence/delegation-network.ts",
    existingPaths: [
      "src/lib/delegation-layer",
      "src/lib/solenos-layers/derived/compute-delegation.ts",
    ],
    improves: ["Delegation Network"] as const,
  },
  {
    asset: "Crisis Prediction Layer",
    strategicType: "CrisisSignal",
    facadePath: "src/lib/family-intelligence/crisis-prediction.ts",
    existingPaths: [
      "src/lib/crisis-prevention-layer",
      "src/lib/solenos-layers/derived/compute-crisis-risks.ts",
    ],
    improves: ["Crisis Prediction", "User Trust"] as const,
  },
] as const;

export const TRUST_MECHANISMS = [
  "Remember",
  "Explain",
  "Reduce Guilt",
  "Prevent Mistakes",
] as const;

export const FAMILY_INTELLIGENCE_PIPELINE_POSITION =
  "Analyze success path — AFTER Confidence/Crisis/Delegation/Decision History write; non-blocking read-mostly snapshot";
