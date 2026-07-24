import type {
  Classification,
  DomainTag,
  SessionMemory,
  SignalVector,
  SolenOSState,
} from "./types";
import { createInitialState } from "./types";

/**
 * Step 7 (memory): Session-only lightweight memory update.
 * Affects weighting only — does NOT change classification rules or schema.
 */
export function updateMemory(
  state: SolenOSState,
  raw: string,
  signals: SignalVector,
  summary: string,
  unresolved: string,
): SessionMemory {
  const memory = { ...state.memory };

  if (/\b(normal|baseline|usually)\b/i.test(raw)) {
    const fact = raw.trim().slice(0, 120);
    if (fact && !memory.baseline_facts.includes(fact)) {
      memory.baseline_facts = [...memory.baseline_facts, fact].slice(-10);
    }
  }

  const medMatches = raw.match(
    /\b(medication|medicine|med|pill|prescription|insulin|antibiotic)s?\b/gi,
  );
  if (medMatches) {
    memory.medications = [
      ...new Set([...memory.medications, ...medMatches.map((m) => m.toLowerCase())]),
    ].slice(-15);
  }

  const providers = raw.match(
    /\b(doctor|physician|nurse|dr\.?\s+\w+|pulmonologist|provider)\b/gi,
  );
  if (providers) {
    memory.provider_names = [
      ...new Set([...memory.provider_names, ...providers.map((p) => p.toLowerCase())]),
    ].slice(-10);
  }

  if (unresolved) {
    memory.unresolved_issues = [
      ...new Set([...memory.unresolved_issues, unresolved]),
    ].slice(-8);
  }

  memory.session_summaries = [...memory.session_summaries, summary.slice(0, 200)].slice(-5);
  memory.turn_count += 1;

  return memory;
}

export function buildNewState(
  prev: SolenOSState,
  params: {
    input: string;
    classification: Classification;
    signals: SignalVector;
    domain: DomainTag;
    secondary_domains: DomainTag[];
    decision: import("./types").DecisionState;
    risk: import("./types").RiskState;
    memory: SessionMemory;
    output: import("../output-contract/types").SolenOSOutput;
    safe_mode: boolean;
  },
): SolenOSState {
  return {
    input: params.input,
    classification: params.classification,
    signals: params.signals,
    domain: params.domain,
    secondary_domains: params.secondary_domains,
    decision: params.decision,
    risk: params.risk,
    memory: params.memory,
    output: params.output,
    safe_mode: params.safe_mode,
  };
}

export { createInitialState };
