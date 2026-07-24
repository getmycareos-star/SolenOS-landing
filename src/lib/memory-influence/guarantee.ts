import type { SituationalCareContext } from "../care-context/situational/types";
import type {
  MemoryInfluenceEnvelope,
  MemoryInfluenceLayerResult,
  MemoryInfluenceState,
  MemorySystemGuaranteeResult,
  SolenOSMemory,
} from "./types";

function hasOutdatedDominance(memory: SolenOSMemory): boolean {
  const allEntries = [
    ...memory.identityMemory.entries,
    ...memory.longTermPatternMemory.entries,
    ...memory.operationalMemory.entries,
    ...memory.emotionalMemory.entries,
  ];
  if (allEntries.length === 0) return false;

  const active = allEntries.filter((e) => !e.tags.outdated && !e.tags.incorrect);
  const outdated = allEntries.filter((e) => e.tags.outdated);
  if (active.length === 0 && outdated.length > 0) return true;

  const maxOutdated = Math.max(...outdated.map((e) => e.influenceWeight), 0);
  const maxActive = Math.max(...active.map((e) => e.influenceWeight), 0);
  return maxOutdated > maxActive && maxOutdated > 0.5;
}

/**
 * Memory Safety Guarantee — before reasoning:
 * - no outdated memory dominates
 * - emotional memory does not override context
 * - identity memory stable
 * - operational memory scoped correctly
 */
export function runMemorySystemGuarantee(params: {
  state: MemoryInfluenceState;
  envelope: MemoryInfluenceEnvelope;
  careContext?: SituationalCareContext;
}): MemorySystemGuaranteeResult {
  const violations: string[] = [];
  const { state, envelope, careContext } = params;

  if (!state?.memory) {
    violations.push("memory influence state not loaded");
  }

  if (hasOutdatedDominance(state.memory)) {
    violations.push("outdated memory dominates active influence weights");
  }

  if (
    careContext &&
    (careContext.urgencyLevel === "CRITICAL" || careContext.situationType === "emergency") &&
    envelope.emotionalBias > envelope.operationalBias * 1.5 &&
    envelope.emotionalBias > 0.3
  ) {
    violations.push("emotional memory overrides situational context in emergency");
  }

  const identityEntries = state.memory.identityMemory.entries.filter((e) => !e.tags.incorrect);
  for (const entry of identityEntries) {
    if (entry.occurrenceCount === 1 && entry.source !== "USER_CONFIRMED") {
      violations.push("identity memory updated from single-instance signal");
    }
  }

  const operationalEntries = state.memory.operationalMemory.entries;
  for (const entry of operationalEntries) {
    if (entry.influenceWeight > 0.9 && entry.occurrenceCount < 2) {
      violations.push("operational memory influence not scoped to repeated signal");
    }
  }

  if (envelope.compositeInfluence > 1) {
    violations.push("composite influence exceeds normalized bounds");
  }

  return { ok: violations.length === 0, violations };
}

export function validateMemoryInfluenceLayerResult(
  result: MemoryInfluenceLayerResult,
): MemorySystemGuaranteeResult {
  return runMemorySystemGuarantee({
    state: result.state,
    envelope: result.envelope,
  });
}
