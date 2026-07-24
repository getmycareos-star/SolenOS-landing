/**
 * SolenOS Response Contract (MVP).
 * SoT: docs/02-product/solenos-response-contract.md
 *
 * Structured orientation from evidence — never a chatbot template.
 * Voice is FUTURE; same contract when it lands.
 */

export const RESPONSE_CONTRACT_PURPOSE =
  "Reduce uncertainty by maintaining an evolving understanding of one person's Care Reality.";

export const RESPONSE_CONTRACT_NOT = [
  "ai_chatbot",
  "document_summarizer",
  "medical_advice_engine",
] as const;

/** Ordered fields — engine always forms these; UI may disclose by maturity. */
export const RESPONSE_CONTRACT_FIELDS = [
  "what_is_happening",
  "what_matters_now",
  "what_to_ask_next",
  "risk_level",
  "what_can_wait",
  "follow_up_items",
] as const;

export type ResponseContractField = (typeof RESPONSE_CONTRACT_FIELDS)[number];

export const RESPONSE_CONTRACT_PIPELINE = [
  "input",
  "evidence_understanding",
  "care_reality_update",
  "situation_relationship_engine",
  "response_contract",
] as const;

export const RESPONSE_RISK_LEVELS = ["low", "medium", "high"] as const;
export type ResponseContractRiskLevel = (typeof RESPONSE_RISK_LEVELS)[number];

/** Caregiver-visible never-say (Response Contract). */
export const RESPONSE_CONTRACT_NEVER_SAY = [
  "i understand how you feel",
  "i'm here for you",
  "im here for you",
  "based on my analysis",
  "according to the uploaded document",
  "i extracted",
  "ocr completed",
  "confidence score",
  "ai thinks",
  "i recommend",
  "it appears diagnosed",
  "as an ai",
  "chatgpt",
] as const;

export const RESPONSE_CONTRACT_SUCCESS =
  "I understand this situation better.";

export const RESPONSE_CONTRACT_FAILURE_FEEL =
  "The AI summarized my note.";

export const RESPONSE_CONTRACT_NON_NEGOTIABLE =
  "Every response must reduce uncertainty, preserve continuity, and maintain the Living Care Record.";

/**
 * Illustrations in docs/tests must never become product templates.
 * Verify scripts may use soft inputs; production composers must derive from evidence.
 */
export const RESPONSE_CONTRACT_NO_HARDCODED_EXAMPLES =
  "Design scenarios are illustrations only — never canned responses in code.";

export type ResponseContractOutput = {
  what_is_happening: string;
  what_matters_now: string;
  what_to_ask_next: string | string[];
  risk_level: ResponseContractRiskLevel;
  what_can_wait: string;
  follow_up_items: string[];
};

export function isResponseContractRiskLevel(
  value: string,
): value is ResponseContractRiskLevel {
  return (RESPONSE_RISK_LEVELS as readonly string[]).includes(value);
}

export function containsResponseContractNeverSay(text: string): boolean {
  const lower = text.toLowerCase();
  return RESPONSE_CONTRACT_NEVER_SAY.some((p) => lower.includes(p));
}

export function assertNoResponseContractNeverSay(
  parts: readonly (string | null | undefined)[],
  label = "response",
): void {
  const blob = parts.filter(Boolean).join("\n");
  if (containsResponseContractNeverSay(blob)) {
    throw new Error(
      `Response Contract never-say leaked in ${label}: ${blob.slice(0, 200)}`,
    );
  }
}

/** Max asks — usually one; never an interview. */
export const RESPONSE_CONTRACT_MAX_ASKS = 3;

export function normalizeContractAsks(
  next: string | readonly string[] | null | undefined,
): string[] {
  if (next == null) return [];
  if (typeof next === "string") {
    const t = next.trim();
    return t ? [t] : [];
  }
  return next.map((s) => s.trim()).filter(Boolean).slice(0, RESPONSE_CONTRACT_MAX_ASKS);
}

/**
 * Build contract output from understanding already formed.
 * Never call as a blank fill-in template.
 */
export function buildResponseContractOutput(params: {
  what_is_happening?: string | null;
  what_matters_now?: string | null;
  what_to_ask_next?: string | readonly string[] | null;
  what_can_wait?: string | null;
  follow_up_items?: readonly string[] | null;
  risk_level?: ResponseContractRiskLevel | null;
}): ResponseContractOutput {
  const asks = normalizeContractAsks(params.what_to_ask_next);
  const risk = params.risk_level ?? "low";

  const output: ResponseContractOutput = {
    what_is_happening: (params.what_is_happening ?? "").trim(),
    what_matters_now: (params.what_matters_now ?? "").trim(),
    what_to_ask_next: asks.length <= 1 ? (asks[0] ?? "") : asks,
    risk_level: risk,
    what_can_wait: (params.what_can_wait ?? "").trim(),
    follow_up_items: (params.follow_up_items ?? [])
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 5),
  };

  assertNoResponseContractNeverSay(
    [
      output.what_is_happening,
      output.what_matters_now,
      typeof output.what_to_ask_next === "string"
        ? output.what_to_ask_next
        : output.what_to_ask_next.join(" "),
      output.what_can_wait,
      ...output.follow_up_items,
    ],
    "response_contract_output",
  );

  return output;
}

/** Guard: scenario illustrations must not drive production branching. */
export function assertNoHardcodedScenarioBranch(usedAsProductLogic: boolean): void {
  if (usedAsProductLogic) {
    throw new Error(
      "Response Contract: design-doc scenarios must never become templates or canned responses.",
    );
  }
}

export {
  RELIEF_DECISION_PURPOSE,
  decideReliefDisclosure,
} from "./relief-decision";
export type {
  ReliefDisclosureMode,
  ReliefDisclosureDecision,
} from "./relief-decision";
export {
  DISCLOSURE_MERGE_PURPOSE,
  mergeReliefIntoDisclosurePlan,
  applyReliefFieldsToDisclosurePlan,
  disclosurePlanFromReliefOnly,
} from "./disclosure-merge";
