import { randomUUID } from "node:crypto";
import type {
  HumanOverrideRecord,
  HumanOverrideRequest,
  HumanOverrideResult,
} from "./types";

const stubStore: HumanOverrideRecord[] = [];

/**
 * Record a human override intent — stub only; does not mutate STATE/BELIEF yet.
 */
export function recordHumanOverride(request: HumanOverrideRequest): HumanOverrideResult {
  const record: HumanOverrideRecord = {
    ...request,
    id: randomUUID(),
    recordedAt: new Date().toISOString(),
    status: "recorded",
  };
  stubStore.push(record);

  const messages: Record<HumanOverrideRequest["kind"], string> = {
    dismiss_priority: "Priority dismissal recorded (stub — not yet applied to ranking).",
    override_assumption: "Assumption override recorded (stub — belief store unchanged).",
    mark_wrong_reasoning: "Wrong-reasoning flag recorded (stub — explanation audit only).",
  };

  return {
    ok: true,
    record,
    message: messages[request.kind],
  };
}

/** List stub overrides for a situation (testing / API surface). */
export function listHumanOverridesForSituation(
  situationId: string,
): readonly HumanOverrideRecord[] {
  return stubStore.filter((r) => r.situationId === situationId);
}

/** Reset stub store — verify scripts only. */
export function resetHumanOverrideStubStore(): void {
  stubStore.length = 0;
}
