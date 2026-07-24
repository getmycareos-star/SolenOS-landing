import {
  ENGINE_EXECUTION_CONTRACT_DEFINING_PRINCIPLE,
  ENGINE_CONTRACT_RULES,
  FORBIDDEN_ENGINE_ACTIONS,
  MUTATION_AUTHORITY,
  REGISTERED_ENGINE_CONTRACTS,
} from "./contract-constants";
import type {
  EngineContractDefinition,
  EngineExecutionContractResult,
  EngineOutputTrace,
  ProcessEngineExecutionContractInput,
} from "./types";

export function getEngineContract(name: string): EngineContractDefinition | null {
  const found = REGISTERED_ENGINE_CONTRACTS.find((c) => c.name === name);
  return found ? { ...found } : null;
}

export function validateEngineInputs(
  engineName: string,
  providedKeys: string[],
): { valid: boolean; missing: string[] } {
  const contract = getEngineContract(engineName);
  if (!contract) return { valid: false, missing: [`unknown_engine:${engineName}`] };
  const missing = contract.required_inputs.filter((k) => !providedKeys.includes(k));
  return { valid: missing.length === 0, missing };
}

/**
 * Hard gate: engines may only emit — never mutate CareContext.
 */
export function assertEmitOnly(engineName: string, attemptedMutation: boolean): string | null {
  if (attemptedMutation) {
    return `${engineName} attempted CareContext mutation — forbidden (emit_only)`;
  }
  return null;
}

export function createOutputTrace(
  partial: Omit<EngineOutputTrace, "timestamp"> & { timestamp?: string },
): EngineOutputTrace {
  return {
    ...partial,
    timestamp: partial.timestamp ?? new Date().toISOString(),
  };
}

export function processEngineExecutionContract(
  input: ProcessEngineExecutionContractInput = {},
): EngineExecutionContractResult {
  const violations: string[] = [];

  for (const name of input.attempted_mutations ?? []) {
    const v = assertEmitOnly(name, true);
    if (v) violations.push(v);
  }

  for (const trace of input.traces ?? []) {
    if (!trace.source_engine || !trace.input_reference_ids) {
      violations.push(`Untraceable output from ${trace.source_engine || "unknown"}`);
    }
  }

  const deterministic = REGISTERED_ENGINE_CONTRACTS.filter((c) => c.execution_type === "deterministic").map(
    (c) => c.name,
  );
  const probabilistic = REGISTERED_ENGINE_CONTRACTS.filter((c) => c.execution_type === "probabilistic").map(
    (c) => c.name,
  );
  const sync = REGISTERED_ENGINE_CONTRACTS.filter((c) => c.timing === "sync").map((c) => c.name);
  const asyncEngines = REGISTERED_ENGINE_CONTRACTS.filter((c) => c.timing === "async").map((c) => c.name);

  return {
    active: true,
    registered_engines: REGISTERED_ENGINE_CONTRACTS.length,
    deterministic_engines: deterministic,
    probabilistic_engines: probabilistic,
    sync_engines: sync,
    async_engines: asyncEngines,
    mutation_authority: MUTATION_AUTHORITY,
    forbidden_actions_blocked: [...FORBIDDEN_ENGINE_ACTIONS],
    violations,
    contract_valid: violations.length === 0,
    rules_upheld: [...ENGINE_CONTRACT_RULES],
    defining_principle: ENGINE_EXECUTION_CONTRACT_DEFINING_PRINCIPLE,
  };
}
