/**
 * Phase 4 scope lock — deferred surfaces until Phase 5 complete.
 * SoT: docs/17-canonical-architecture/scope-lock.md
 */
export { assertFutureCapabilityNotMvp } from "../future-capabilities";
export {
  PHASE_SCOPE_DEFER_LIST,
  PHASE_SCOPE_LOCK_STATUS,
  PHASE_SCOPE_UNLOCK,
  assertPhaseScopeLockNotMvp,
} from "./gates";
export type { PhaseScopeDeferEntry, PhaseScopeDeferId, PhaseScopeLockResult } from "./gates";
export {
  DEFERRED_SURFACE_PATH_PREFIXES,
  assertAllFutureCapabilityProbesBlocked,
  assertDeferredSurfaceFile,
  isDeferredSurfacePath,
  normalizeRepoPath,
  scanDeferredSurfaceContent,
  validateChangedFilesForDeferredScope,
} from "./deferred-surfaces";
export type { DeferredSurfaceViolation } from "./deferred-surfaces";
