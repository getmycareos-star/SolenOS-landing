import type {
  OWNERSHIP_STATES,
  RESPONSIBILITY_HEALTH_STATES,
  RESPONSIBILITY_STATUSES,
} from "./contract-constants";

export type ResponsibilityStatus = (typeof RESPONSIBILITY_STATUSES)[number];
export type OwnershipState = (typeof OWNERSHIP_STATES)[number];
export type ResponsibilityHealthState =
  (typeof RESPONSIBILITY_HEALTH_STATES)[number];

/** Operational person node — not a contact-list CRM record. */
export type Person = {
  id: string;
  name: string;
  role: string;
  relationship: string;
  availability?: string;
  contactInfo?: string;
};

/**
 * Ownership edge: Person → Responsibility → Demand → Situation.
 * STATUS lives on Responsibility (STATE).
 */
export type Responsibility = {
  id: string;
  demandId: string;
  ownerId: string;
  status: ResponsibilityStatus;
  assignedAt: string;
  completedAt?: string;
  /** Optional blocker note when ownership cannot proceed. */
  blockedReason?: string;
  situationId?: string;
};

export type DemandOwnershipEval = {
  demandId: string;
  situationId: string;
  ownershipState: OwnershipState;
  ownerIds: readonly string[];
  ownerNames: readonly string[];
  pressureScore: number;
  highPressure: boolean;
  blockedReason?: string;
  /** Unassigned + high pressure → escalate immediately. */
  criticalUnassigned: boolean;
};

export type ResponsibilityLoad = {
  personId: string;
  activeResponsibilities: number;
  highPressureResponsibilities: number;
  loadScore: number;
  overloaded: boolean;
};

export type OwnershipConflict = {
  conflictId: string;
  demandId?: string;
  situationId?: string;
  detail: string;
  storedOwnerHint: string;
  inferredOwnerHint: string;
  detectedAt: string;
  resolved: boolean;
};

export type MissedResponsibilityRecord = {
  responsibilityId: string;
  demandId: string;
  ownerId: string;
  failedAt: string;
  reason?: string;
};

export type ResponsibilityGraphState = {
  userId: string;
  persons: Person[];
  responsibilities: Responsibility[];
  conflicts: OwnershipConflict[];
  missed: MissedResponsibilityRecord[];
};

export type ResponsibilityHealth = {
  state: ResponsibilityHealthState;
  activeDemandCount: number;
  assignedCount: number;
  unassignedCount: number;
  sharedCount: number;
  blockedCount: number;
  criticalUnassignedCount: number;
  conflictCount: number;
  repeatedFailureOwnerIds: readonly string[];
  summary: string;
};

export type ResponsibilityGraphEnvelope = {
  health: ResponsibilityHealth;
  ownershipEvals: readonly DemandOwnershipEval[];
  loads: readonly ResponsibilityLoad[];
  /** Soft uncertainty influence — never invents owners. */
  ownershipUncertainty: number;
  escalate: boolean;
  influenceHints: readonly string[];
};

export type ResponsibilityGraphGuaranteeResult = {
  ok: boolean;
  violations: string[];
};

export type ResponsibilityGraphLayerResult = {
  state: ResponsibilityGraphState;
  envelope: ResponsibilityGraphEnvelope;
  guarantee: ResponsibilityGraphGuaranteeResult;
};

export type ResponsibilityGraphLayerPayload = {
  health: ResponsibilityHealthState;
  activeDemandCount: number;
  unassignedCount: number;
  criticalUnassignedCount: number;
  conflictCount: number;
  personCount: number;
  escalate: boolean;
  ownershipUncertainty: number;
  /** Primary owner name for Decision Surface (next action). */
  primaryOwnerName: string | null;
  primaryOwnershipState: OwnershipState | null;
  influenceHints: readonly string[];
  overloadedPersonIds: readonly string[];
};
