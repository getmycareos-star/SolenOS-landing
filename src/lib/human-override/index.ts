/**
 * Human Override — v1.4 gap stub.
 * API: dismiss priorities, override assumptions, mark wrong reasoning.
 */

export {
  HUMAN_OVERRIDE_KINDS,
  type HumanOverrideKind,
  type HumanOverrideRequest,
  type HumanOverrideRecord,
  type HumanOverrideResult,
} from "./types";

export {
  recordHumanOverride,
  listHumanOverridesForSituation,
  resetHumanOverrideStubStore,
} from "./stubs";
