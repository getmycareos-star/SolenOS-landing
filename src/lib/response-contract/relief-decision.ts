/**
 * Relief disclosure decision — single locked gate for Response Contract orientation.
 * SoT: docs/02-product/solenos-response-contract.md · caregiver-response-contract.md
 *
 * Relief = caregiver can answer: what is happening · what matters · what to ask ·
 * what can wait · follow-up. Not empathy. Not summarization.
 *
 * Engine always *forms* contract fields when care anchors exist.
 * UI *discloses* by this decision — never by illustration templates.
 */

import type { CaregiverTurnClass } from "../response-behavior";
import { isProductSessionMetaText } from "../care-epistemics";

export const RELIEF_DECISION_PURPOSE =
  "Disclose Response Contract orientation when care reality can orient — soft-only stays gather-first (G1).";

export type ReliefDisclosureMode =
  | "empty"
  | "awaiting_care_evidence"
  | "product_meta_turn"
  | "soft_gather"
  | "orient_with_gaps"
  | "orient_complete"
  | "record_answer"
  | "pushback";

export type ReliefDisclosureDecision = {
  mode: ReliefDisclosureMode;
  /** Form all six Response Contract fields from evidence (may be thin). */
  form_full_contract: boolean;
  show_what_is_happening: boolean;
  show_clarity: boolean;
  show_asks: boolean;
  show_follow_up: boolean;
  max_asks: number;
};

/**
 * Single decision tree — replaces ad-hoc Clarity vs gather conflicts.
 *
 * softVague + insufficient → soft_gather (G1: no Clarity)
 * sufficient + gaps → orient_with_gaps (Clarity + ≤1 ask)
 * sufficient + no gaps → orient_complete (Clarity; asks only if engine still has gaps)
 */
export function decideReliefDisclosure(params: {
  turnClass: CaregiverTurnClass;
  softVague: boolean;
  understandingSufficient: boolean;
  careContextGapsRemain: boolean;
  careWorthyCount: number;
  /** False when latest turn is product/session meta — never disclose relief from this turn. */
  latestIsCareWorthy?: boolean;
  /** Latest turn raw text — used to distinguish product meta from thin care captures. */
  latestRawText?: string;
}): ReliefDisclosureDecision {
  const { turnClass, softVague, understandingSufficient, careContextGapsRemain } =
    params;
  const latestIsCareWorthy = params.latestIsCareWorthy ?? params.careWorthyCount > 0;
  const latestIsProductMeta =
    Boolean(params.latestRawText?.trim()) &&
    !latestIsCareWorthy &&
    isProductSessionMetaText(params.latestRawText!.trim());

  if (turnClass === "empty_or_thin") {
    return {
      mode: "empty",
      form_full_contract: false,
      show_what_is_happening: false,
      show_clarity: false,
      show_asks: true,
      show_follow_up: false,
      max_asks: 1,
    };
  }

  if (turnClass === "record_question") {
    return {
      mode: "record_answer",
      form_full_contract: true,
      show_what_is_happening: false,
      show_clarity: false,
      show_asks: false,
      show_follow_up: false,
      max_asks: 0,
    };
  }

  // No care-worthy evidence yet — invite capture; never care-story / Clarity theater.
  if (params.careWorthyCount <= 0 && turnClass !== "pushback") {
    return {
      mode: "awaiting_care_evidence",
      form_full_contract: false,
      show_what_is_happening: false,
      show_clarity: false,
      show_asks: true,
      show_follow_up: false,
      max_asks: 1,
    };
  }

  // Prior care exists but this turn is product meta — no relief from this turn.
  if (latestIsProductMeta && turnClass !== "pushback") {
    return {
      mode: "product_meta_turn",
      form_full_contract: false,
      show_what_is_happening: false,
      show_clarity: false,
      show_asks: true,
      show_follow_up: false,
      max_asks: 1,
    };
  }

  if (turnClass === "pushback") {
    return {
      mode: "pushback",
      form_full_contract: understandingSufficient,
      show_what_is_happening: understandingSufficient,
      show_clarity: understandingSufficient,
      show_asks: false,
      show_follow_up: false,
      max_asks: 0,
    };
  }

  // G1 — soft-only mood: hold + one invite; Clarity forbidden until more care context.
  if (softVague && !understandingSufficient) {
    return {
      mode: "soft_gather",
      form_full_contract: params.careWorthyCount > 0,
      show_what_is_happening: false,
      show_clarity: false,
      show_asks: true,
      show_follow_up: false,
      max_asks: 1,
    };
  }

  if (!understandingSufficient) {
    return {
      mode: "soft_gather",
      form_full_contract: params.careWorthyCount > 0,
      show_what_is_happening: false,
      show_clarity: false,
      show_asks: true,
      show_follow_up: false,
      max_asks: params.careWorthyCount <= 1 ? 1 : 3,
    };
  }

  // Orientable / sufficient care reality → Response Contract relief.
  if (careContextGapsRemain && turnClass !== "improvement") {
    return {
      mode: "orient_with_gaps",
      form_full_contract: true,
      show_what_is_happening: true,
      show_clarity: true,
      show_asks: true,
      show_follow_up: true,
      max_asks: 1,
    };
  }

  return {
    mode: "orient_complete",
    form_full_contract: true,
    show_what_is_happening: true,
    show_clarity: true,
    show_asks: false,
    show_follow_up: true,
    max_asks: 0,
  };
}
