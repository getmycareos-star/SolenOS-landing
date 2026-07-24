import type { SolenOSResponse } from "../response-validator";

import { checkInterpretationStability } from "./interpretation-stability";

import { checkPriorityStability } from "./priority-stability";

import { checkPromptRegression } from "./prompt-regression";

import { checkRepeatedInputConsistency } from "./repeated-input";

import { verifyStructureDrift } from "./structure-drift";

import type {

  ConsistencyCheckResult,

  DeterminismFailureType,

  InterpretationStabilityResult,

  PriorityStabilityResult,

  PromptRegressionCheckResult,

  StructureDriftResult,

} from "./types";



export type DeterminismGateResult =

  | { ok: true }

  | {

      ok: false;

      failure_type: DeterminismFailureType;

      reason?: string;

    };



/**

 * Mandatory deterministic checks (section 11) — zero runtime variability.

 */

export function runDeterminismGate(params: {

  rawParsed: unknown;

  validated: SolenOSResponse;

  normalizedInput: string;

}): DeterminismGateResult {

  const repeated: ConsistencyCheckResult = checkRepeatedInputConsistency(

    params.normalizedInput,

    params.validated,

  );

  if (!repeated.ok) {

    return { ok: false, failure_type: repeated.failure_type };

  }



  const structure: StructureDriftResult = verifyStructureDrift(

    params.rawParsed,

    params.validated,

  );

  if (!structure.ok) {

    return {

      ok: false,

      failure_type: structure.failure_type,

      reason: structure.reason,

    };

  }



  const priority: PriorityStabilityResult = checkPriorityStability(

    params.normalizedInput,

    params.validated,

  );

  if (!priority.ok) {

    return { ok: false, failure_type: priority.failure_type };

  }



  const interpretation: InterpretationStabilityResult = checkInterpretationStability(

    params.normalizedInput,

    params.validated,

  );

  if (!interpretation.ok) {

    return { ok: false, failure_type: interpretation.failure_type };

  }



  const regression: PromptRegressionCheckResult = checkPromptRegression(

    params.normalizedInput,

    params.validated,

  );

  if (!regression.ok) {

    return { ok: false, failure_type: regression.failure_type };

  }



  return { ok: true };

}


