import { z } from "zod";



import { SOLENOS_FIELD_ORDER } from "../consistency-determinism/types";

import {

  FinalOutputContractSchema,

  validateFinalOutput,

  extractFinalOutputPayload,

  type FinalOutputContract,

  type FinalOutputValidationError,

} from "../final-output-contract";



export { SOLENOS_FIELD_ORDER };



/** Canonical SolenOS output — identical to FinalOutputContract (source of truth). */

export const SolenOSResponseSchema = FinalOutputContractSchema;



export const SolenOSSchema = SolenOSResponseSchema;



export type SolenOSResponse = FinalOutputContract;



export type ValidationError = {
  type: "INVALID_SCHEMA" | "INVALID_FINAL_OUTPUT";
  message: string;
  raw_output: unknown;
};



export function validateAIResponse(output: unknown): SolenOSResponse {

  try {

    return validateFinalOutput(extractFinalOutputPayload(output));

  } catch (err) {

    if (

      typeof err === "object" &&

      err !== null &&

      (err as FinalOutputValidationError).type === "INVALID_FINAL_OUTPUT"

    ) {

      throw {

        ...(err as FinalOutputValidationError),

        type: "INVALID_SCHEMA",

      } satisfies ValidationError;

    }

    throw err;

  }

}



export function isValidationError(error: unknown): error is ValidationError {

  return (

    typeof error === "object" &&

    error !== null &&

    ((error as ValidationError).type === "INVALID_SCHEMA" ||

      (error as ValidationError).type === "INVALID_FINAL_OUTPUT") &&

    typeof (error as ValidationError).message === "string" &&

    "raw_output" in error

  );

}



export function extractSolenOSDisplayFields(output: SolenOSResponse): SolenOSResponse {

  return output;

}



export function extractSolenOSPayload(output: unknown): unknown {

  return extractFinalOutputPayload(output);

}



export function gateForUI(output: unknown): SolenOSResponse {

  return validateAIResponse(output);

}



export { withMeta, withDecisionTrace } from "./fixtures";

