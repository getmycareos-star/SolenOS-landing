import type {
  MISSING_INFORMATION_IMPORTANCE,
  MISSING_INFORMATION_SOURCES,
  MISSING_INFORMATION_STATUSES,
} from "./contract-constants";

export type MissingInformationStatus =
  (typeof MISSING_INFORMATION_STATUSES)[number];

export type MissingInformationSource =
  (typeof MISSING_INFORMATION_SOURCES)[number];

export type MissingInformationImportance =
  (typeof MISSING_INFORMATION_IMPORTANCE)[number];

/** Knowledge gap scoped to a situation — never a work item. */
export type MissingInformationItem = {
  id: string;
  /** MUST belong to a situation — never global. */
  situationId: string;
  question: string;
  importance: MissingInformationImportance;
  source: MissingInformationSource;
  status: MissingInformationStatus;
  /** ISO-8601 string for serializability. */
  createdAt: string;
  resolvedAt?: string;
};

export type MissingInformationQueuePolicy = {
  expirationDays: number;
};

export type MissingInformationQueueState = {
  userId: string;
  items: MissingInformationItem[];
  policy: MissingInformationQueuePolicy;
};

export type MissingInformationHealth = {
  openItems: number;
  highPriorityItems: number;
  resolvedItems: number;
};

export type MissingInformationInfluenceEnvelope = {
  openCount: number;
  highPriorityOpenCount: number;
  /** [0,1] confidence reduction applied by Priority Engine. */
  confidencePenalty: number;
  /** [0,1] uncertainty boost applied by Priority Engine. */
  uncertaintyBoost: number;
  /** Knowledge questions for Decision Card / Situation View — never tasks. */
  needsNext: readonly string[];
  health: MissingInformationHealth;
};

export type MissingInformationResolutionEvent = {
  itemId: string;
  question: string;
  reason: string;
  trigger: "user_input" | "document" | "memory" | "expiration";
};

export type MissingInformationQueueGuaranteeResult = {
  ok: boolean;
  violations: string[];
};

export type MissingInformationQueueLayerResult = {
  state: MissingInformationQueueState;
  envelope: MissingInformationInfluenceEnvelope;
  resolutions: readonly MissingInformationResolutionEvent[];
  expirations: readonly string[];
  guarantee: MissingInformationQueueGuaranteeResult;
};

export type MissingInformationQueueLayerPayload = {
  openCount: number;
  highPriorityOpenCount: number;
  confidencePenalty: number;
  uncertaintyBoost: number;
  needsNext: readonly string[];
  health: MissingInformationHealth;
  recentResolutions: readonly MissingInformationResolutionEvent[];
};
