/**
 * SolenOS Intelligence Layer — memory strategy.
 *
 * Implements the memory purpose test from the Intelligence Specification:
 * "Will this help future orientation?"
 *
 * This module decides whether extracted facts should be committed to
 * longitudinal memory, rejected as noise, or flagged for monitoring.
 * It also generates memory proposals, continuity hooks, and decay candidates.
 */

import type { CanonicalCareEvent } from "../situation-entry";
import type { CareSituationUnderstanding } from "../care-situation-understanding";
import type { SolenOSMemory, MemoryStrategyResult } from "./types";

const MEMORY_WORTHY_PATTERNS = /\b(?:medication|medicine|dose|changed|hospital|fall|discharge|admitted|doctor|specialist|decision|appointment|outcome|resolved|worsened|improved|baseline|pattern|confusion|mobility|appetite|stability|safety|risk|provider|therapy|prescription)\b/i;

const NOISE_PATTERNS = /\b(?:hi|hello|hey|thanks|thank you|okay|ok|got it|sounds good|will do|sounds? like|I understand|take care|bye|goodbye|see you|morning|evening|afternoon)\b/i;

const CONTINUITY_HOOK_PATTERNS = /\b(?:follow\s*up|check\s+(?:back|in|on)|call\s+(?:back|the\s+doctor)|next\s+(?:appointment|visit)|monitor|watch|track|recheck)\b/i;

const DECAY_CANDIDATE_PATTERNS = /\b(?:temporary|once|today\s+only|just\s+this\s+time|single\s+occurrence)\b/i;

export function applyMemoryStrategy(params: {
  input: string;
  understanding: CareSituationUnderstanding;
  memory: SolenOSMemory;
}): MemoryStrategyResult {
  const { input, understanding, memory } = params;

  if (NOISE_PATTERNS.test(input.trim()) && understanding.facts.length === 0) {
    return {
      willRemember: false,
      memoryReason: "noise",
      openLoopsIdentified: memory.careRealityState?.open_uncertainties.length ?? 0,
      memoryProposals: [],
      continuityHooks: [],
      decayCandidates: [],
    };
  }

  const hasMemoryWorthyContent =
    understanding.facts.some((f) => MEMORY_WORTHY_PATTERNS.test(f.text)) ||
    understanding.changes_from_baseline.length > 0 ||
    understanding.possible_links.length > 0;

  if (!hasMemoryWorthyContent && understanding.facts.length <= 1) {
    return {
      willRemember: false,
      memoryReason: "insufficient longitudinal value",
      openLoopsIdentified: memory.careRealityState?.open_uncertainties.length ?? 0,
      memoryProposals: [],
      continuityHooks: [],
      decayCandidates: [],
    };
  }

  const openLoopsIdentified =
    understanding.unknowns.filter((u) =>
      memory.careRealityState?.open_uncertainties.some((prior) =>
        u.toLowerCase().includes(prior.toLowerCase().slice(0, 24)) ||
        prior.toLowerCase().includes(u.toLowerCase().slice(0, 24)),
      ),
    ).length + (memory.careRealityState?.open_uncertainties.length ?? 0);

  const memoryProposals = understanding.facts
    .filter((f) => MEMORY_WORTHY_PATTERNS.test(f.text))
    .map((f) => ({
      type: f.kind,
      description: f.text,
      priority: f.kind === "outcome" ? 3 : f.kind === "decision" ? 2 : f.kind === "event" ? 2 : 1,
      evidence_ref: f.source_fragment ?? null,
    }));

  const continuityHooks = understanding.facts
    .filter((f) => CONTINUITY_HOOK_PATTERNS.test(f.text))
    .map((f) => f.text);

  const decayCandidates = understanding.facts
    .filter((f) => DECAY_CANDIDATE_PATTERNS.test(f.text))
    .map((f) => ({
      type: f.kind,
      description: f.text,
      priority: 1,
    }));

  return {
    willRemember: true,
    memoryReason: hasMemoryWorthyContent
      ? "contains longitudinal care facts"
      : "preserves uncertainty",
    openLoopsIdentified,
    memoryProposals,
    continuityHooks,
    decayCandidates,
  };
}
