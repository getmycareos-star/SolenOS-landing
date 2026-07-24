import type { ConfidenceState } from "../solenos-layers/derived/compute-confidence";

export type { ConfidenceState };

export type ConfidenceLayerPayload = ConfidenceState & {
  guaranteeOk: boolean;
};

export type ConfidenceLayerResult = {
  state: ConfidenceState;
  guarantee: { ok: boolean; violations: string[] };
};
