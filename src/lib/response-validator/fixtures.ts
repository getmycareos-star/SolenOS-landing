import type { SolenOSResponse } from "./index";

/** @deprecated Schema is strict 6-field — pass full payload directly. */
export function withMeta(fields: SolenOSResponse): SolenOSResponse {
  return fields;
}

/** @deprecated */
export const withDecisionTrace = withMeta;
