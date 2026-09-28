/**
 * Caregiver as person — identity, capacity, fears, values.
 *
 * The existing layers model the caregiver as a load gauge. This layer adds
 * the missing piece: who the caregiver *is* as a person. Without it, SolenOS
 * cannot tailor its help to their life, their capacity, or their fears.
 */

export const CAREGIVER_PERSON_VERSION = "1.0.0";

export type CaregiverCapacity = {
  physical: "high" | "moderate" | "low" | "unknown";
  cognitive: "high" | "moderate" | "low" | "unknown";
  emotional: "high" | "moderate" | "low" | "unknown";
  time: "high" | "moderate" | "low" | "unknown";
  financial: "high" | "moderate" | "low" | "unknown";
  social: "high" | "moderate" | "low" | "unknown";
  evidence: string[];
  confidence: number;
  recordedAt: string;
};

export type CaregiverValue = {
  id: string;
  text: string;
  source: "stated" | "inferred";
  confidence: number;
  recordedAt: string;
};

export type CaregiverFear = {
  id: string;
  text: string;
  severity: "low" | "medium" | "high";
  source: "stated" | "inferred";
  recordedAt: string;
};

export type CaregiverGoal = {
  id: string;
  text: string;
  status: "active" | "achieved" | "abandoned" | "unclear";
  source: "stated" | "inferred";
  recordedAt: string;
};

export type CaregiverConstraint = {
  id: string;
  text: string;
  kind: "time" | "financial" | "physical" | "social" | "legal" | "other";
  flexibility: "rigid" | "some_flex" | "flexible";
  source: "stated" | "inferred";
  recordedAt: string;
};

export type CaregiverPersonModel = {
  version: string;
  caregiverId: string;
  displayName: string | null;
  relationshipToPerson: string | null;
  values: CaregiverValue[];
  fears: CaregiverFear[];
  goals: CaregiverGoal[];
  constraints: CaregiverConstraint[];
  capacity: CaregiverCapacity | null;
  createdAt: string;
  updatedAt: string;
};

export function createEmptyCaregiverPerson(params: {
  caregiverId: string;
  displayName?: string | null;
  relationshipToPerson?: string | null;
  createdAt?: string;
}): CaregiverPersonModel {
  const now = params.createdAt ?? new Date().toISOString();
  return {
    version: CAREGIVER_PERSON_VERSION,
    caregiverId: params.caregiverId,
    displayName: params.displayName ?? null,
    relationshipToPerson: params.relationshipToPerson ?? null,
    values: [],
    fears: [],
    goals: [],
    constraints: [],
    capacity: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function summarizeCaregiverPerson(model: CaregiverPersonModel): {
  valuesCount: number;
  fearsHigh: number;
  goalsActive: number;
  constraintsRigid: number;
  hasCapacity: boolean;
  hasStatedValues: boolean;
  hasStatedFears: boolean;
} {
  return {
    valuesCount: model.values.length,
    fearsHigh: model.fears.filter((f) => f.severity === "high").length,
    goalsActive: model.goals.filter((g) => g.status === "active").length,
    constraintsRigid: model.constraints.filter((c) => c.flexibility === "rigid").length,
    hasCapacity: model.capacity !== null,
    hasStatedValues: model.values.some((v) => v.source === "stated"),
    hasStatedFears: model.fears.some((f) => f.source === "stated"),
  };
}