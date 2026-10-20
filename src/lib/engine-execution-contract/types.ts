import type {
  ENGINE_CONTRACT_RULES,
  EXECUTION_TIMINGS,
  EXECUTION_TYPES,
  FORBIDDEN_ENGINE_ACTIONS,
  MUTATION_AUTHORITY,
} from "./contract-constants";

export type ExecutionType = (typeof EXECUTION_TYPES)[number];
export type ExecutionTiming = (typeof EXECUTION_TIMINGS)[number];

export type EngineContractDefinition = {
  name: string;
  execution_type: ExecutionType;
  timing: ExecutionTiming;
  mutation_authority: typeof MUTATION_AUTHORITY;
  required_inputs: readonly string[];
  optional_inputs: readonly string[];
  outputs: readonly string[];
};

export type EngineOutputTrace = {
  source_engine: string;
  input_reference_ids: string[];
  confidence: number | null;
  timestamp: string;
  output_kind: "event" | "signal" | "recommendation" | "transformation" | "contradiction_flag";
};

export type EngineExecutionContractResult = {
  active: boolean;
  registered_engines: number;
  deterministic_engines: string[];
  probabilistic_engines: string[];
  sync_engines: string[];
  async_engines: string[];
  mutation_authority: typeof MUTATION_AUTHORITY;
  forbidden_actions_blocked: readonly (typeof FORBIDDEN_ENGINE_ACTIONS)[number][];
  violations: string[];
  contract_valid: boolean;
  rules_upheld: readonly (typeof ENGINE_CONTRACT_RULES)[number][];
  defining_principle: string;
};

export type ProcessEngineExecutionContractInput = {
  /** Engines that attempted CareContext mutation this cycle (should always be empty). */
  attempted_mutations?: string[];
  /** Optional traces emitted this cycle */
  traces?: EngineOutputTrace[];
};
