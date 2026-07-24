import type { CrisisRisk } from "../solenos-layers/derived/compute-crisis-risks";

export type { CrisisRisk };

export type CrisisPreventionLayerPayload = {
  risks: readonly CrisisRisk[];
  topRiskProbability: number;
  guaranteeOk: boolean;
};

export type CrisisPreventionLayerResult = {
  risks: readonly CrisisRisk[];
  guarantee: { ok: boolean; violations: string[] };
};
