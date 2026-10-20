/**
 * DERIVED — demand pressureScore pure computation.
 * Demands themselves are STATE; pressure is never an independent store.
 */

export {
  computePressureScore,
  withPressureScore,
  clampScore100,
} from "../../demand-engine/pressure";

export {
  rankDemandsByPressure,
  selectTopPressureDemands,
  buildDemandEngineOutput,
} from "../../demand-engine/rank";
