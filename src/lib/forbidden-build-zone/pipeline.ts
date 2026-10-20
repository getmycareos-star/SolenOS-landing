import {
  ACCEPTABLE_BUILD_SURFACE,
  FORBIDDEN_BUILD_RULES,
  FORBIDDEN_BUILD_ZONE_DEFINING_PRINCIPLE,
} from "./contract-constants";
import { scanAllOutputSurfaces, scanForbiddenFeatureRequest } from "./build-filter";
import type { ForbiddenBuildZoneResult, ProcessForbiddenBuildZoneInput } from "./types";

export function processForbiddenBuildZone(
  input: ProcessForbiddenBuildZoneInput,
): ForbiddenBuildZoneResult {
  const output_violations = scanAllOutputSurfaces(input.output_surfaces);
  const violations = input.requested_feature
    ? scanForbiddenFeatureRequest(input.requested_feature)
    : [];

  return {
    active: true,
    violations,
    output_violations,
    build_filter_passed: output_violations.length === 0 && violations.length === 0,
    acceptable_surface_only: true,
    rules_upheld: [...FORBIDDEN_BUILD_RULES],
    defining_principle: FORBIDDEN_BUILD_ZONE_DEFINING_PRINCIPLE,
  };
}

export { ACCEPTABLE_BUILD_SURFACE, FORBIDDEN_BUILD_RULES };
