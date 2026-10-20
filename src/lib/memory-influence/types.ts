import type {
  MEMORY_CATEGORIES,
  MEMORY_UPDATE_CONDITIONS,
  MEMORY_VISIBILITY_LEVELS,
} from "./contract-constants";
import type { MemoryVisibility } from "../settings-governance/types";

export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

export type MemoryUpdateCondition = (typeof MEMORY_UPDATE_CONDITIONS)[number];

export type MemoryVisibilityLevel = (typeof MEMORY_VISIBILITY_LEVELS)[number];

export type MemoryEntryTags = {
  outdated: boolean;
  incorrect: boolean;
  sensitive: boolean;
};

export type MemoryInfluenceEntry = {
  id: string;
  key: string;
  /** Structured influence descriptor — NOT a factual assertion. */
  influenceLabel: string;
  influenceWeight: number;
  confidence: number;
  occurrenceCount: number;
  tags: MemoryEntryTags;
  source: MemoryUpdateCondition;
  createdAt: string;
  updatedAt: string;
};

export type IdentityMemory = {
  entries: MemoryInfluenceEntry[];
};

export type PatternMemory = {
  entries: MemoryInfluenceEntry[];
};

export type OperationalMemory = {
  entries: MemoryInfluenceEntry[];
};

export type EmotionalMemory = {
  entries: MemoryInfluenceEntry[];
};

export type MemoryCategoryWeights = {
  identity: number;
  patterns: number;
  operational: number;
  emotional: number;
};

export type MemoryDeletionPolicy = {
  allowFullDelete: boolean;
  allowCategoryDelete: boolean;
  allowSelectiveForget: boolean;
};

export type MemoryTaggingSystem = {
  outdated: boolean;
  incorrect: boolean;
  sensitive: boolean;
};

export type SolenOSMemory = {
  identityMemory: IdentityMemory;
  longTermPatternMemory: PatternMemory;
  operationalMemory: OperationalMemory;
  emotionalMemory: EmotionalMemory;
  memoryWeights: MemoryCategoryWeights;
  visibility: MemoryVisibility;
  taggingSystem: MemoryTaggingSystem;
  deletionPolicy: MemoryDeletionPolicy;
  inferenceFromBehavior: boolean;
};

export type MemoryDeletionEvent = {
  id: string;
  deletedAt: string;
  category?: MemoryCategory;
  entryId?: string;
  reason: string;
  reconciled: boolean;
};

export type MemoryInfluenceState = {
  userId: string;
  memory: SolenOSMemory;
  signalOccurrenceCounts: Record<string, number>;
  deletionLog: MemoryDeletionEvent[];
};

export type MemoryInfluenceSignal = {
  category: MemoryCategory;
  kind: string;
  confidence: number;
  detail: string;
  influenceLabel: string;
  userConfirmed: boolean;
};

export type MemoryInfluenceEnvelope = {
  identityBias: number;
  patternBias: number;
  operationalBias: number;
  emotionalBias: number;
  compositeInfluence: number;
  /** Structured summary hints for summary/full visibility — never raw memory facts. */
  interpretationHints: readonly string[];
};

export type MemorySystemGuaranteeResult = {
  ok: boolean;
  violations: string[];
};

export type MemoryInfluenceLayerResult = {
  state: MemoryInfluenceState;
  envelope: MemoryInfluenceEnvelope;
  appliedUpdates: readonly MemoryInfluenceEntry[];
  guarantee: MemorySystemGuaranteeResult;
};

export type MemoryInfluenceLayerPayload = {
  visibility: MemoryVisibility;
  activeEntryCount: number;
  compositeInfluence: number;
  categoryWeights: MemoryCategoryWeights;
  envelope: MemoryInfluenceEnvelope;
};
