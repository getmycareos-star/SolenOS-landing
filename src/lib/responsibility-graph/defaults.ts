import type { ResponsibilityGraphState } from "./types";

export function createDefaultResponsibilityGraphState(
  userId: string,
): ResponsibilityGraphState {
  return {
    userId,
    persons: [],
    responsibilities: [],
    conflicts: [],
    missed: [],
  };
}
