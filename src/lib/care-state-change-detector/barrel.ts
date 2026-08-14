/**
 * Care State Change Detector — public exports.
 */

export {
  detectCareStateChanges,
  domainForEvent,
  signalsForEvent,
} from "./index";

export type {
  CareDomain,
  ChangeClassification,
  DomainChange,
  CompoundSignal,
  CareStateChangeReport,
} from "./index";
