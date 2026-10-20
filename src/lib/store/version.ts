import type { CognitiveVersion } from "./types";

export const COGNITIVE_VERSION: CognitiveVersion = {
  kernel_version: "1.0.0",
  reasoning_spec_version: "build-spec-v1",
  decision_engine_version: "1.0.0",
  risk_engine_version: "1.0.0",
  schema_version: "1.0.0",
};

export function versionsMatch(a: CognitiveVersion, b: CognitiveVersion): boolean {
  return (
    a.kernel_version === b.kernel_version &&
    a.reasoning_spec_version === b.reasoning_spec_version &&
    a.decision_engine_version === b.decision_engine_version &&
    a.risk_engine_version === b.risk_engine_version &&
    a.schema_version === b.schema_version
  );
}
