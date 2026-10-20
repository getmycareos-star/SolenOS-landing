import type { DelegationSuggestion } from "../solenos-layers/derived/compute-delegation";

export type { DelegationSuggestion };

export type DelegationLayerPayload = {
  suggestions: readonly DelegationSuggestion[];
  loadElevated: boolean;
  guaranteeOk: boolean;
};

export type DelegationLayerResult = {
  suggestions: readonly DelegationSuggestion[];
  loadElevated: boolean;
  guarantee: { ok: boolean; violations: string[] };
};
