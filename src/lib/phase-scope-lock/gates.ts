import { assertFutureCapabilityNotMvp } from "../future-capabilities";

export const PHASE_SCOPE_LOCK_STATUS = "ACTIVE" as const;
export const PHASE_SCOPE_UNLOCK = "phase_5_complete" as const;

export type PhaseScopeDeferId =
  | "situation_graph_ui"
  | "pipeline_reorder"
  | "future_capability_ui"
  | "postgres_graph_tables"
  | "runtime_north_star_block"
  | "analyze_primary_caregiver_path";

export type PhaseScopeDeferEntry = {
  id: PhaseScopeDeferId;
  label: string;
  reason: string;
  unblock: typeof PHASE_SCOPE_UNLOCK;
};

export const PHASE_SCOPE_DEFER_LIST: readonly PhaseScopeDeferEntry[] = [
  {
    id: "situation_graph_ui",
    label: "Situation Graph UI",
    reason: "No graph infra in MVP",
    unblock: PHASE_SCOPE_UNLOCK,
  },
  {
    id: "pipeline_reorder",
    label: "Full pipeline.ts reorder",
    reason: "Product truth path already chose composer (Path A)",
    unblock: PHASE_SCOPE_UNLOCK,
  },
  {
    id: "future_capability_ui",
    label: "Care Moment / I Need Clarity UI",
    reason: "Future capabilities ADR — use assertFutureCapabilityNotMvp",
    unblock: PHASE_SCOPE_UNLOCK,
  },
  {
    id: "postgres_graph_tables",
    label: "PostgreSQL graph tables as runtime truth",
    reason: "SCHEMA-ONLY — MVP = ACS + event attributes",
    unblock: PHASE_SCOPE_UNLOCK,
  },
  {
    id: "runtime_north_star_block",
    label: "Runtime North Star block on every feature",
    reason: "Telemetry-first; ADR required if enforced at compose time",
    unblock: PHASE_SCOPE_UNLOCK,
  },
  {
    id: "analyze_primary_caregiver_path",
    label: "v1.4 analyze as primary caregiver path",
    reason: "MVP product truth = POST /api/situation composer path",
    unblock: PHASE_SCOPE_UNLOCK,
  },
] as const;

export type PhaseScopeLockResult = {
  blocked: boolean;
  reason: string;
  deferId?: PhaseScopeDeferId;
};

const SCOPE_MATCHERS: Array<{
  id: PhaseScopeDeferId;
  patterns: RegExp[];
  reason: string;
}> = [
  {
    id: "situation_graph_ui",
    patterns: [
      /situation graph ui/i,
      /situation-graph/i,
      /graph visualization.*situation/i,
      /renderSituationGraph/i,
    ],
    reason: PHASE_SCOPE_DEFER_LIST.find((d) => d.id === "situation_graph_ui")!.reason,
  },
  {
    id: "pipeline_reorder",
    patterns: [
      /reorder processSituationInput/i,
      /move final_output before compose/i,
      /composer after internal compile only.*reorder/i,
      /full pipeline\.ts reorder/i,
    ],
    reason: PHASE_SCOPE_DEFER_LIST.find((d) => d.id === "pipeline_reorder")!.reason,
  },
  {
    id: "postgres_graph_tables",
    patterns: [
      /wire care_situations.*product path/i,
      /postgres graph.*runtime truth/i,
      /care_situations.*primary.*acs/i,
    ],
    reason: PHASE_SCOPE_DEFER_LIST.find((d) => d.id === "postgres_graph_tables")!.reason,
  },
  {
    id: "runtime_north_star_block",
    patterns: [
      /block compose.*north star/i,
      /throw.*feature_gate_passed/i,
      /runtime north star gate/i,
      /evaluateFeatureAgainstNorthStar.*composeCaregiverResponse/i,
    ],
    reason: PHASE_SCOPE_DEFER_LIST.find((d) => d.id === "runtime_north_star_block")!.reason,
  },
  {
    id: "analyze_primary_caregiver_path",
    patterns: [
      /mvp workspace.*\/api\/analyze/i,
      /primary caregiver.*analyze-pipeline/i,
      /CognitiveWorkspace.*\/api\/analyze/i,
      /caregiver path.*POST \/api\/analyze/i,
    ],
    reason: PHASE_SCOPE_DEFER_LIST.find((d) => d.id === "analyze_primary_caregiver_path")!.reason,
  },
];

export function assertPhaseScopeLockNotMvp(featureDescription: string): PhaseScopeLockResult {
  const future = assertFutureCapabilityNotMvp(featureDescription);
  if (future.blocked) {
    return {
      blocked: true,
      reason: future.reason,
      deferId: "future_capability_ui",
    };
  }

  for (const { id, patterns, reason } of SCOPE_MATCHERS) {
    if (patterns.some((p) => p.test(featureDescription))) {
      return { blocked: true, reason, deferId: id };
    }
  }

  return { blocked: false, reason: "Not a Phase 4 deferred scope item." };
}
