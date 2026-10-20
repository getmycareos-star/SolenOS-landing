/**
 * Human Override — v1.4 contract stubs.
 * Caregivers may dismiss priorities, override assumptions, and mark wrong reasoning.
 * Stubs record intent only; full persistence wiring is future work.
 */

export const HUMAN_OVERRIDE_KINDS = [
  "dismiss_priority",
  "override_assumption",
  "mark_wrong_reasoning",
] as const;

export type HumanOverrideKind = (typeof HUMAN_OVERRIDE_KINDS)[number];

export type HumanOverrideRequest = {
  situationId: string;
  kind: HumanOverrideKind;
  targetId?: string;
  note?: string;
  userId?: string;
};

export type HumanOverrideRecord = HumanOverrideRequest & {
  id: string;
  recordedAt: string;
  status: "recorded" | "applied_stub";
};

export type HumanOverrideResult = {
  ok: boolean;
  record: HumanOverrideRecord;
  message: string;
};
