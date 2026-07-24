import type {
  ACCEPTABLE_BUILD_SURFACE,
  FORBIDDEN_BUILD_RULES,
  FORBIDDEN_FEATURE_CATEGORIES,
} from "./contract-constants";

export type ForbiddenFeatureCategory = (typeof FORBIDDEN_FEATURE_CATEGORIES)[number];
export type AcceptableBuildSurface = (typeof ACCEPTABLE_BUILD_SURFACE)[number];

export type BuildFilterResult = {
  allowed: boolean;
  improves_care_record: boolean;
  passes_event_state_pipeline: boolean;
  reason: string;
};

export type ForbiddenBuildZoneResult = {
  active: boolean;
  violations: { category: ForbiddenFeatureCategory; matched: string }[];
  output_violations: string[];
  build_filter_passed: boolean;
  acceptable_surface_only: boolean;
  rules_upheld: readonly (typeof FORBIDDEN_BUILD_RULES)[number][];
  defining_principle: string;
};

export type ProcessForbiddenBuildZoneInput = {
  output_surfaces: Record<string, string | string[]>;
  requested_feature?: string;
};
